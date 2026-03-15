// s2-service/services/ocrWorker.js
const fs = require('fs').promises;
const axios = require('axios');
const Bottleneck = require('bottleneck');

// 1. Set the absolute server limit. 
// If this is 1, the AI will strictly process 1 image at a time, globally.
const imageLimiter = new Bottleneck({ 
    maxConcurrent: 1 
});

// 2. Wrap the SINGLE IMAGE function, not the batch!
const extractTextFromImage = async (imagePath) => {
    // Your heavy AI logic here
    return new Promise(resolve => setTimeout(() => resolve("Extracted text"), 2000));
};

// This is the gatekeeper. Nothing bypasses this.
const rateLimitedOcr = imageLimiter.wrap(extractTextFromImage); 

// 3. The Batch Processor
const runBottleneckProcessor = async (batchId, files) => {
    console.log(`🚀 Queuing ${files.length} images for Batch ${batchId}...`);

    // We map over the files, but they DO NOT execute immediately.
    // They are instantly thrown into the imageLimiter queue.
    const tasks = files.map(async (file) => {
        try {
            // 🚨 THE MAGIC: The code pauses right here for each file.
            // If maxConcurrent is 1, image 2 will not move past this line until image 1 finishes.
            const text = await rateLimitedOcr(file.path);

            // DB Update for this single image
            await OcrBatch.updateOne(
                { _id: batchId, "images.filePath": file.path },
                { $set: { "images.$.status": "COMPLETED", "images.$.extractedText": text } }
            );

            // Notify Gateway
            await axios.post('http://127.0.0.1:3000/internal/sse-notify', {
                batchId: batchId, status: 'IMAGE_COMPLETED', data: { path: file.path }
            }).catch(() => {});

        } catch (error) {
            await OcrBatch.updateOne(
                { _id: batchId, "images.filePath": file.path },
                { $set: { "images.$.status": "FAILED" } }
            );
        } finally {
            // Cleanup the single image
            await fs.unlink(file.path).catch(() => {});
        }
    });

    // This waits for the entire array to finish clearing the Bottleneck queue
    await Promise.allSettled(tasks);
    
    // Notify Gateway that the whole batch is finally done
    await axios.post('http://127.0.0.1:3000/internal/sse-notify', {
        batchId: batchId, status: 'BATCH_COMPLETE'
    }).catch(() => {});
};

