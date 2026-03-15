require("module-alias/register");

const fs = require('fs-extra');
const pdf2img = require('pdf-img-convert');
const grpc = require("@grpc/grpc-js")

const {CatchAsync, AppError} = require("@shared/utils/handler")

const ProcessFile = CatchAsync(async (call, callback) => {
    const { userId, files } = call.request;

    // 1. Create the document. MongoDB instantly generates the _id.
    const newBatch = await OcrBatch.create({
        userId: userId,
        images: files.map(file => ({
            filePath: file.path,
            status: 'PENDING'
        }))
    });

    const batchId = newBatch._id.toString();

    // 2. Fire the background processor (Do not await!)
    runBottleneckProcessor(batchId, files).catch(err => {
        console.error(`[CRASH] Batch ${batchId}:`, err);
    });

    // 3. Hand the _id back to the Gateway
    callback(null, { batchId: batchId });
});

module.exports = { processFile };