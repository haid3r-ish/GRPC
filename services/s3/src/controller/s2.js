require("module-alias/register");

const { CatchAsync } = require("@util/errHandler")
const { callClient } = require("@util/mwareUtil");
const {s2Client} = require("@util/require");
const {AppError, diverge} = require("@shared/utils/handler")

// const CLIENT_IMAGE_PATH = ""

const processFiles = CatchAsync(async (req, res) => {
    try {
        const userId = req.user.id; 
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

const getDoc = CatchAsync(async (req, res) => {
    const batchId = req.params.batchId;
    const userId = req.user.id;

    let doc = await callClient(s2Client, "GetDoc", { batchId, userId });
    if (!doc) throw new AppError("Document not found or already accessed.", 404);

    doc = JSON.parse(doc.docData); // Convert string back to object if needed

    res.status(200).json({
        status: "success",
        message: doc.isFirstFetch 
            ? "First fetch complete. Images cleared from server." 
            : "Fetched from history. Images no longer available.",
        isFirstFetch: doc.isFirstFetch,
        data: doc.data 
    });

});

const getAllDocs = CatchAsync(async (req, res) => {
    const userId = req.user.id;

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


module.exports = {processFiles, getDoc, getAllDocs};