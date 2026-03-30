require("module-alias/register");
const fs = require('fs-extra');
const axios = require("axios"); 

const { Ocr } = require("@utils/require");
const { refundCredit } = require("@middleware/verifyCost");

const GLOBAL_S3_URL = "http://localhost:3000/api/file"

// ==========================================
// 1. GLOBAL TOKEN QUEUE (Semaphore Pattern)
// ==========================================
const MAX_CONCURRENT_IMAGES = 5; 
let availableTokens = MAX_CONCURRENT_IMAGES;
const waitingQueue = []; // Array of Promise resolve functions

// Halts the loop until tokens are available and it's your turn
const waitForTokens = async () => {
    // return if tokens are available and no one is waiting
    if (availableTokens > 0 && waitingQueue.length === 0) {
        return;
    }

    // await the promise to stop task executions until resolved
    await new Promise(resolve => {
        waitingQueue.push(resolve);
    });
};

// Function to resolve the promise of next waiting task 
const wakeUpNext = () => {
    if (waitingQueue.length > 0 && availableTokens > 0) {
        const nextTaskResolve = waitingQueue.shift(); // Grab the task at the front
        nextTaskResolve(); // Wake it up
    }
};

// Ai call function
const AiCall = async (batchId, filesChunk) => {
    const time = new Date().toISOString().substring(11, 19);
    console.log(`[${time}] ⚙️ AI Axios Call Started: Sending ${filesChunk.length} images for batch ${batchId}`);
    
    // TODO: Replace with actual Axios POST request
    await new Promise(resolve => setTimeout(resolve, filesChunk.length * 2000));
    
    return filesChunk.map(file => ({
        filePath: file.path,
        success: true, 
        extractedText: "Extracted text for " + file.path 
    }));
};

//Main Function
const runBottleneckProcessor = async (userId, batchId, files) => {
    // variable for finally block to calculate refund
    const totalImages = files.length;
    // subtract successfull from total to get failed
    let successfulCount = 0; 

    try {
        let remainingFiles = [...files]; 
        const processingTasks = []; 

        while (remainingFiles.length > 0) {
            // hit function to check for wait status
            await waitForTokens();
            // safety check, if token are zero , continue wait
            if (availableTokens <= 0) continue;

            const tokensToTake = Math.min(remainingFiles.length, availableTokens);
            availableTokens -= tokensToTake;

            // after deducting, if token are available woke up next task to start processing
            if (availableTokens > 0) {
                wakeUpNext();
            }

            const currentChunk = remainingFiles.splice(0, tokensToTake);

            // Make chunck and store them in task array
            const chunkTask = (async () => {
                try {
                    const results = await AiCall(batchId, currentChunk);

                    const updatePromises = results.map(async (res) => {
                        if (res.success) {
                            await Ocr.updateOne(
                                { _id: batchId, "images.filePath": res.filePath },
                                { $set: { "images.$.status": "COMPLETED", "images.$.extractedText": res.extractedText } }
                            );
                            
                            // 2. Safely increment our success counter!
                            successfulCount++; 
                            
                            return { status: 'fulfilled' }; 
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
                    const failPromises = currentChunk.map(file => 
                        Ocr.updateOne(
                            { _id: batchId, "images.filePath": file.path },
                            { $set: { "images.$.status": "FAILED" } }
                        )
                    );
                    await Promise.allSettled(failPromises);
                    return currentChunk.map(() => ({ status: 'rejected' }));
                } finally {
                    availableTokens += tokensToTake;
                    wakeUpNext(); 
                }
            })(); 

            processingTasks.push(chunkTask);
        }

        // Wait until every single chunk is completely done
        await Promise.all(processingTasks);

        

    } catch(error) {
        // If the code breaks entirely, it lands here.
        console.error(`🔥 Critical Error in Bottleneck Processor for batch ${batchId}:`, error);
        
    } finally {
        axios.post(GLOBAL_S3_URL + "/internal/notify", { batchId }, {headers: { "x-internal-secret": process.env.INTERNAL_SECRET }})
        .catch(err => {
            console.error(`🚨 CRITICAL: Failed to notify S3 about completion of batch ${batchId}:`, err);
        });

        const failedOrUnprocessedCount = totalImages - successfulCount;
        
        if (failedOrUnprocessedCount > 0) {
            await refundCredit(userId, failedOrUnprocessedCount).catch(err => {
                console.error(`🚨 CRITICAL: Failed to process refund for user ${userId}:`, err);
            });
        }        
    }   
};

module.exports = { runBottleneckProcessor };