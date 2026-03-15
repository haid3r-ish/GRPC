require("module-alias/register");

const {CatchAsync} = require("@util/errHandler");
const {AppError} = require("@shared/utils/handler");
const {callClient} = require("@shared/utils/grpc");
const {s2Client} = require("@util/require");

const processFiles = CatchAsync(async (req, res) => {
    const userId = req.user.id; 

    const grpcResponse = await callClient(s2Client, "ProcessFile", {
        userId: userId,
        files: req.grpcFiles
    });

    res.status(202).json({
        status: "success",
        batchId: grpcResponse.batchId,
        stats: {
            totalPagesAnalyzed: res.locals.totalPages,
            remainingCredits: res.locals.remainingCredits
        }
    });
});

module.exports = {processFiles}