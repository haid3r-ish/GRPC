require("module-alias/register");
const fs = require('fs-extra');
const axios = require("axios"); 
const { EventEmitter } = require('events'); // Native Node.js event tracker

const { Ocr } = require("@utils/require");
const { refundCredit } = require("@middleware/verifyCost");

// ==========================================
// 1. GLOBAL TOKEN TRACKER (Replaces Bottleneck)
// ==========================================
const MAX_CONCURRENT_IMAGES = 5; 
let availableTokens = MAX_CONCURRENT_IMAGES;
const tokenEvents = new EventEmitter();

// This halts the loop until at least 1 token is freed up
const waitForTokens = async () => {
    while (availableTokens <= 0) {
        await new Promise(resolve => tokenEvents.once('freed', resolve));
    }
};

// ==========================================
// 2. AI CALL (Now receives an ARRAY of images!)
// ==========================================
const AiCall = async (batchId, filesChunk) => {
    const time = new Date().toISOString().substring(11, 19);
    console.log(`[${time}] ⚙️ AI Axios Call Started: Sending ${filesChunk.length} images for batch ${batchId}`);
    
    // TODO: Replace this timeout with your actual Axios POST request.
    // Make sure your backend Python/AI model is expecting an array of images!
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // We mock the response here. Your AI must return which specific images passed/failed
    // so we can update MongoDB and refund properly.
    return filesChunk.map(file => ({
        filePath: file.path,
        success: true, // or false if the AI failed on this specific page
        extractedText: "Extracted text for " + file.path 
    }));
};

// ==========================================
// 3. THE ALGORITHM
// ==========================================
const runBottleneckProcessor = async (userId, batchId, files) => { 
    try {
        let remainingFiles = [...files]; // Clone the array so we can slice it
        const processingTasks = []; 

        while (remainingFiles.length > 0) {
            // A. Wait for system capacity
            await waitForTokens();

            // B. Calculate how many images we can process right now
            const tokensToTake = Math.min(remainingFiles.length, availableTokens);
            
            // C. Instantly reserve those tokens so other requests can't steal them
            availableTokens -= tokensToTake;

            // D. Slice the exact chunk off the remaining files
            const currentChunk = remainingFiles.splice(0, tokensToTake);

            console.log(`📦 Batch ${batchId} divided: Sending chunk of ${tokensToTake} images. (${availableTokens} tokens left system-wide)`);

            // E. Fire the Axios call in the background (DO NOT use 'await' here)
            const chunkTask = (async () => {
                try {
                    // Send multiple images in ONE network call
                    const results = await AiCall(batchId, currentChunk);

                    // Update MongoDB for every file in this chunk
                    const updatePromises = results.map(async (res) => {
                        if (res.success) {
                            await Ocr.updateOne(
                                { _id: batchId, "images.filePath": res.filePath },
                                { $set: { "images.$.status": "COMPLETED", "images.$.extractedText": res.extractedText } }
                            );
                            return { status: 'fulfilled' }; // Helps our refund math later
                        } else {
                            await Ocr.updateOne(
                                { _id: batchId, "images.filePath": res.filePath },
                                { $set: { "images.$.status": "FAILED" } }
                            );
                            throw new Error("Specific image failed in AI response"); 
                        }
                    });

                    return await Promise.allSettled(updatePromises);

                } catch (error) {
                    // If the ENTIRE Axios call crashes (e.g., 500 error from AI server)
                    console.error(`🚨 AI Call failed for a chunk in batch ${batchId}`, error.message);
                    
                    const failPromises = currentChunk.map(file => 
                        Ocr.updateOne(
                            { _id: batchId, "images.filePath": file.path },
                            { $set: { "images.$.status": "FAILED" } }
                        )
                    );
                    await Promise.allSettled(failPromises);
                    
                    // Return 'rejected' for EVERY file in this chunk so the refund handles them
                    return currentChunk.map(() => ({ status: 'rejected' }));
                } finally {
                    // F. When the Axios call finishes, refund the tokens back to the system
                    availableTokens += tokensToTake;
                    tokenEvents.emit('freed'); // Wake up any waiting batches!
                }
            })(); 

            // Add this chunk's background task to our tracker
            processingTasks.push(chunkTask);
        }

        // ==========================================
        // 4. WAIT FOR ALL CHUNKS TO FINISH & REFUND
        // ==========================================
        
        // Wait until every single chunk of this batch is completely done
        const chunkResults = await Promise.all(processingTasks);
        
        // chunkResults looks like this: [ [{status:'fulfilled'}, {status:'fulfilled'}], [{status:'rejected'}] ]
        // We use .flat() to smash them into a single array of files so we can count the failures
        const allFileResults = chunkResults.flat();
        
        console.log(`✅ Batch ${batchId} network processing complete.`);

        const failedCount = allFileResults.filter(r => r.status === 'rejected').length;

        if (failedCount > 0) {
            console.log(`⚠️ Batch ${batchId}: ${failedCount} images failed. Refunding user...`);
            await refundCredit(userId, failedCount); 
        }
        
        console.log(`🚀 Batch ${batchId} processing finished. Notifying Express server...`);
        // await axios.post('http://127.0.0.1:3000/internal/sse-notify', { batchId, status: 'BATCH_COMPLETE' }).catch(() => {});

    } catch(error) {
        console.log("Critical Error in Bottleneck Processor:", error);
    }   
};

module.exports = { runBottleneckProcessor };