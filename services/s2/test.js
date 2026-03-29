// ocrWorker.js
const Bottleneck = require('bottleneck');

const IMG_DIR = "./../s3/temp"

// ==========================================
// 🧪 MOCKS FOR TESTING (Replaces real DB/Network)
// ==========================================
const OcrBatch = {
    updateOne: async () => { /* Fake DB update */ }
};
const axios = {
    post: async () => { /* Fake SSE webhook */ }
};

// ==========================================
// 🚀 THE CORE WORKER LOGIC
// ==========================================

// 1. Set the absolute server limit. (1 image globally)
const imageLimiter = new Bottleneck({ 
    maxConcurrent: 1
});

// 2. Wrap the SINGLE IMAGE function
const extractTextFromImage = async (batchId, imagePath) => {
    // Added a timestamp log so you can watch the strict 2-second interval!
    const time = new Date().toISOString().substring(11, 19);
    console.log(`[${time}] ⚙️ AI Processing Started: ${imagePath} for batch ${batchId}`);
    
    return new Promise(resolve => setTimeout(() => resolve("Extracted text"), 2000));
};

// The gatekeeper
const rateLimitedOcr = imageLimiter.wrap(extractTextFromImage); 

// 3. The Batch Processor


// ==========================================
// 🏁 THE CONCURRENCY TEST RUNNER
// ==========================================
// This block only runs if you execute this file directly in the terminal
if (require.main === module) {
    (async () => {
        console.log("🚨 STARTING MASSIVE CONCURRENCY TEST 🚨\n");
    
        // Create 3 fake batches with different amounts of images
        const batch1 = [{ path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-1.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-2.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-3.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-4.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-5.png` }];
        const batch2 = [{ path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-1.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-2.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-3.png` }]; // Only 1 image
        const batch3 = [{ path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-1.png` }];
        const batch4 = [{ path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-1.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-2.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-3.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-4.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-5.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-6.png` }, { path: `${IMG_DIR}/Ali-Ehtisham-Resume1-page-5.png` }];
    
        // Fire all 3 batches at the EXACT SAME MILLISECOND
        await Promise.all([
            runBottleneckProcessor("BATCH_1", batch1),
            runBottleneckProcessor("BATCH_2", batch2),
            runBottleneckProcessor("BATCH_3", batch3)
        ]).then(() => {
            console.log("\n🎉 ALL BATCHES FINISHED FLAWLESSLY!");
        });

        runBottleneckProcessor("BATCH_4", batch4).then(() => {
            console.log("\n🎉 BATCH 4 FINISHED FLAWLESSLY!");
        });
    })();
}

module.exports = { runBottleneckProcessor };