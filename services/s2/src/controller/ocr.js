require("module-alias/register");

const fs = require('fs-extra');
const grpc = require("@grpc/grpc-js")

const {CatchAsync, AppError} = require("@shared/utils/handler")
const {Ocr, User} = require("@utils/require")
const {refundCredit} = require("@middleware/verifyCost")
const {runBottleneckProcessor} = require("@utils/bottleneck")

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

module.exports = { ProcessFile };