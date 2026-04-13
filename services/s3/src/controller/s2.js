require("module-alias/register");

const axios = require("axios");
const path = require("path");
const fs = require("fs").promises;

const { CatchAsync } = require("@util/errHandler")
const { callClient } = require("@util/mwareUtil");
const {s2Client} = require("@util/require");
const {AppError, diverge, verifyNullish} = require("@shared/utils/handler")

const OUTPUT_FILE_TARGET_PATH = path.join(__dirname, "../../temp/output_files/");

const processFiles = CatchAsync(async (req, res) => {
    try {
        const userId = req.user.id; 
        if(verifyNullish(userId)) throw new AppError("User ID is missing in the request.", 400);

        const grpcResponse = await callClient(s2Client, "ProcessFile", {
            userId: userId,
            files: req.grpcFiles
        });
        // skipping cleanUp since s2 will handle images now
        req.skipCleanup = true;
        
        res.status(202).json({
            status: "success",
            batchId: grpcResponse.batchId,
            stats: {
                totalPagesAnalyzed: res.locals.totalPages,
                remainingCredits: res.locals.remainingCredits
            }
        });
    } catch (error) {
        await callClient(s2Client, "RefundCall", {userId: req.user.id, amount: res.locals.totalPages})
        .catch(err => console.log(`Failed to Refund Error: ${err.message}`));
        
        throw new AppError(error.message || "Error Occured in processFiles", error.statusCode || 500);
    }
});

// const getDoc = CatchAsync(async (req, res) => {
//     const batchId = req.params.batchId;
//     const userId = req.user.id;
//     if(verifyNullish(batchId, userId)) throw new AppError("Batch ID and User ID are required.", 400);
//     let doc = await callClient(s2Client, "GetDoc", { batchId, userId });
//     if (!doc) throw new AppError("Document not found or already accessed.", 404);

//     doc = JSON.parse(doc.docData); // Convert string back to object if needed

//     res.status(200).json({
//         status: "success",
//         message: doc.isFirstFetch 
//             ? "First fetch complete. Images cleared from server." 
//             : "Fetched from history. Images no longer available.",
//         isFirstFetch: doc.isFirstFetch,
//         data: doc.data 
//     });

// });

const getDoc = CatchAsync(async (req, res) => {
    const batchId = req.params.batchId;
    const userId = req.user.id;
    if(verifyNullish(batchId, userId)) throw new AppError("Batch ID and User ID are required.", 400);

    const rawResponse = await callClient(s2Client, "GetDoc", { batchId, userId });
    if (!rawResponse || !rawResponse.docData) {
        throw new AppError("Document not found", 404);
    }
    
    const parsedDoc = diverge(rawResponse.docData);
    const finalData = [];

    for (const item of parsedDoc.data) {
        let base64Image = null;

        if (parsedDoc.isFirstFetch && item.status === "COMPLETED" && item.fileName) {
            const fullPath = path.join(OUTPUT_FILE_TARGET_PATH, item.fileName);

            try {
                const fileBuffer = await fs.readFile(fullPath);
                base64Image = `data:image/png;base64,${fileBuffer.toString('base64')}`;

                // Express deletes the file
                await fs.unlink(fullPath);
                console.log(`🗑️ Express deleted local file: ${item.fileName}`);
            } catch (err) {
                console.error(`🚨 Express failed to read/delete file ${item.fileName}:`, err.message);
            }
        }

        finalData.push({
            status: item.status,
            fileName: item.fileName ? item.fileName.split("-").slice(1).join("-") : null, 
            extractedText: item.extractedText || "No text extracted",
            imageSrc: base64Image || null
        });
    }

    res.status(200).json({
        status: "success",
        message: parsedDoc.isFirstFetch 
            ? "First fetch complete. Images cleared from server." 
            : "Fetched from history.",
        data: {
            batchId: parsedDoc.batchId,
            isFirstFetch: parsedDoc.isFirstFetch,
            results: finalData
        }
    });
});

const getAllDocs = CatchAsync(async (req, res) => {
    const userId = req.user.id;
    if(verifyNullish(userId)) throw new AppError("User ID is missing in the request.", 400);

    const rawResponse = await callClient(s2Client, "GetAllDocs", { userId });

    if (!rawResponse || !rawResponse.docsData) {
        return res.status(200).json({
            status: "success",
            results: 0,
            data: []
        });
    }

    const docs = diverge(rawResponse.docsData);

    res.status(200).json({
        status: "success",
        results: docs.length,
        data: docs
    });
});

const getHistory = CatchAsync(async (req, res) => {
    const userId = req.user.id;
    if(verifyNullish(userId)) throw new AppError("User ID is missing in the request.", 400);


    let docs = await callClient(s2Client, "GetHistory", { userId });

    if (!docs) throw new AppError("No documents found for this user.", 404);
    docs = diverge(docs.docsData);
    res.status(200).json({
        status: "success",
        data: docs
    });
});

const checkRangharHealth = CatchAsync(async (req, res) => {
    const serverUrl = "https://fifty-turtles-attack.loca.lt"
    console.log(`Checking health of Ranghar API at ${serverUrl}...`);
    const resp = await axios.get(`${serverUrl}/health`);
    console.log("Ranghar API health check response:", resp);
    // if (resp.status === 200) console.log("Ranghar API is healthy");

    res.send("done")

});

module.exports = {processFiles, getDoc, getAllDocs, getHistory, checkRangharHealth};