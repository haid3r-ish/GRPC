require("module-alias/register");

const fs = require('fs-extra');
const grpc = require("@grpc/grpc-js")
const path = require("path");

const {CatchAsync, AppError} = require("@shared/utils/handler")
const {Ocr, User} = require("@utils/require")
const {refundCredit} = require("@middleware/verifyCost")
const {runBottleneckProcessor} = require("@utils/bottleneck");
const { get } = require("http");
const { converge } = require("../../../../shared/utils/handler");

const OUTPUT_FILE_TARGET_PATH = path.join(__dirname, "./../../../s3/temp/output_files/");

const ProcessFile = CatchAsync(async (call, callback) => {
    const { userId, files } = call.request;
    
    // 1. Create the document. MongoDB instantly generates the _id.
    const newBatch = await Ocr.create({
        userId: userId
    });
    if (!newBatch) throw new AppError("Failed to create document batch.", 500);
    const batchId = newBatch._id.toString();
    // 2. Fire the background processor
    // setImmediate(() => {
        runBottleneckProcessor(userId, batchId, files)
            .catch(async (error) => {
                console.error(`Error in Bottleneck Processor for batch ${batchId}:`, error);
            })
            .finally(async () => {
                if (!(files && Array.isArray(files))) return;
                const deletePromises = files.map(file => 
                    fs.unlink(file.path).catch(() => {}) // Ignore if already deleted
                );
                await Promise.all(deletePromises);
            });
    // });
    // 3. Hand the _id back to the Gateway
    callback(null, { batchId });
});

const GetDoc = CatchAsync(async (call, callback) => {
    const { batchId, userId } = call.request;

    const doc = await Ocr.findOneAndUpdate(
        { _id: batchId, userId: userId },
        { $set: { fetched: true } }
    );

    if (!doc) throw new AppError("Document not found or already accessed.", 404);
    const isFirstFetch = !doc.fetched;
    const formattedData = [];

    for (const item of doc.data) {
        let base64Image = null;

        if (isFirstFetch && item.status === "COMPLETED" && item.fileName) {
            const fullPath = path.join(OUTPUT_FILE_TARGET_PATH, item.fileName);

            try {
                const fileBuffer = await fs.readFile(fullPath);
                base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;

                await fs.unlink(fullPath);
                console.log(`🗑️ First Fetch: Deleted local file ${item.fileName}`);
            } catch (err) {
                console.error(`🚨 Failed to read/delete file ${item.fileName}:`, err.message);
            }
        }

        formattedData.push({
            status: item.status,
            fileName: item.fileName.split("-").slice(1).join("-"), 
            extractedText: item.extractedText,
            imageSrc: base64Image 
        });
    }

    callback(null, {docData: converge({
        batchId: doc._id.toString(),
        fetched: true, 
        isFirstFetch: isFirstFetch, 
        data: formattedData
    })});
});

const GetAllDocs = CatchAsync(async (call, callback) => {
    const { userId } = call.request;

    const docs = await Ocr.find({ userId: userId, fetched: false }).sort({ createdAt: -1 });

    const formattedDocs = docs.map(doc => {
        return {
            batchId: doc._id.toString(),
            createdAt: doc.createdAt,
            files: doc.data.map(item => {
                if (item.fileName) {
                    return item.fileName.split("-").slice(1).join("-");
                }
                return "unknown_file";
            })
        };
    });

    callback(null, {
        docsData: converge(formattedDocs) 
    });
});

const GetHistory = CatchAsync(async (call, callback) => {
    const {userId} = call.request;
    
    const docs = await Ocr.find({userId: userId}).sort({createdAt: -1});
    if(!docs) throw new AppError("No documents found for this user.", 404);

    const formattedDocs = docs.map(doc => {
            return {
                batchId: doc._id.toString(),
                createdAt: doc.createdAt,
                isFetched: doc.fetched ? "Fetched (files already retrieved and deleted)" : "Not fetched (files still available for download)",
                files: doc.data.map(item => {
                    if (item.fileName) return item.fileName.split("-").slice(1).join("-");
                    return "unknown_file";
                })
            };
        }
    );
    
    callback(null, {
        docsData: converge(formattedDocs)
    });
});

module.exports = { ProcessFile, GetDoc, GetAllDocs, GetHistory };