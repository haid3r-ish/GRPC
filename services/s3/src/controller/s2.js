require("module-alias/register");

const { CatchAsync } = require("@util/errHandler")
const { callClient } = require("@util/mwareUtil");
const {s2Client} = require("@util/require");
const {AppError} = require("@shared/utils/handler")

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

module.exports = {processFiles}