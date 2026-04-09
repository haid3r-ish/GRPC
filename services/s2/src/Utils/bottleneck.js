require("dotenv").config();
require("module-alias/register");

const fs = require('fs-extra');
const axios = require("axios"); 
const path = require("path");
const FormData = require("form-data");  
const { Ocr } = require("@utils/require");
const { refundCredit } = require("@middleware/verifyCost");

const OUTPUT_FILE_TARGET_PATH = "D:\\VScodium\\gRPC\\services\\s3\\temp\\output_files\\";

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

async function saveOutputFile(base64Data, sourceFilename) {
    await fs.writeFile(`${OUTPUT_FILE_TARGET_PATH}/${sourceFilename}`, Buffer.from(base64Data, "base64"));
}

// ==================== DEBUGGING ADDED IN AiCall ====================
const AiCall = async (batchId, filesChunk) => {
    
    try {
        const formData = new FormData();

        for (const fileObj of filesChunk) {
            const fileStream = fs.createReadStream(fileObj.path);
            formData.append('files', fileStream, path.basename(fileObj.path));
        }

        let response = await axios.post(
            `${process.env.RANGHAR_API_URL}/process-pages`,
            formData,
            {
                headers: formData.getHeaders(),
                timeout: 120000,
                maxContentLength: Infinity,
                maxBodyLength: Infinity
            }
        );
        // const rawData = fs.readFileSync("D:\\VScodium\\gRPC\\services\\s2\\src\\Utils\\raw_response.json", "utf-8");
        // const response = JSON.parse(rawData);
        let returningObj = [];
        const pages = response.data.pages_numbered;
        response = null
        // const pages = response.pages_numbered;
        if (!pages) {
            throw new Error("Invalid API response: missing pages_numbered");
        }
        
        for(const [pageName, pageData] of Object.entries(pages)) {
            try {
                if(!pageData.qwen_success) throw `Page ${pageName} failed Qwen check.`;
            const base64Data = pageData.annotated_image_base64 || pageData.annotated_image_data_url?.split(",")[1];
                if(!base64Data) throw `No image data found for ${pageData.source_filename}`;
                await saveOutputFile(base64Data, pageData.source_filename);
                returningObj.push({
                    success: true,
                    filePath: `${OUTPUT_FILE_TARGET_PATH}${pageData.source_filename}`,
                    extractedText: pageData.text || null
                })
            } catch (error) {
                returningObj.push({
                    success: false,
                    filePath: `${OUTPUT_FILE_TARGET_PATH}${pageData.source_filename}`,
                    extractedText: pageData.text || error.message
                })
            }
        }
        
        return returningObj;
        
    } catch (error) {
        throw error;
    }
};

// (async () => {
//     const dummyFiles = [
//         { path: path.join(OUTPUT_FILE_TARGET_PATH, "img1.jpeg") },
//         { path: path.join(OUTPUT_FILE_TARGET_PATH, "img2.jpeg") },
//     ];
//     const result = await AiCall("dummyBatchId", dummyFiles);
//     console.log("API call result:", result);
// })();
// ==================== DEBUGGING ADDED IN runBottleneckProcessor ====================
const runBottleneckProcessor = async (userId, batchId, files) => {
    await new Promise(resolve => setImmediate(resolve));
    
    const totalImages = files.length;
    let successfulCount = 0; 

    try {
        let remainingFiles = [...files]; 
        const processingTasks = []; 
        let chunkIndex = 0;

        while (remainingFiles.length > 0) {
            
            await waitForTokens();
            
            if (availableTokens <= 0) {
                continue;
            }

            const tokensToTake = Math.min(remainingFiles.length, availableTokens);
            availableTokens -= tokensToTake;

            if (availableTokens > 0) {
                wakeUpNext();
            }

            const currentChunk = remainingFiles.splice(0, tokensToTake);

            // 1. chunkTask now RETURNS the formatted data instead of updating the DB
            const chunkTask = (async () => {
                try {
                    const results = await AiCall(batchId, currentChunk);
                    
                    const mapped = results.map((res) => {
                        if (res.success) {
                            successfulCount++;
                            return {
                                filePath: res.filePath,
                                status: "COMPLETED",
                                extractedText: res.extractedText
                            };
                        } else {
                            return {
                                status: "FAILED",
                                extractedText: res.extractedText
                            };
                        }
                    });
                    return mapped;

                } catch (error) {
                    
                    // Return failure states for this specific chunk
                    const failures = currentChunk.map(file => ({
                        filePath: path.basename(file.path),
                        status: "FAILED"
                    }));
                    return failures;

                } finally {
                    availableTokens += tokensToTake;
                    wakeUpNext(); 
                }
            })(); 
            processingTasks.push(chunkTask);
            chunkIndex++;
        }

        const nestedResults = await Promise.all(processingTasks);

        const finalDataToSave = nestedResults.flat();

        if (finalDataToSave.length > 0) {
            await Ocr.updateOne(
                { _id: batchId },
                { 
                    $push: { 
                        data: { $each: finalDataToSave } 
                    } 
                }
            );
        } 


    } catch(error) {
        console.error(`🔥 Critical Error in Bottleneck Processor for batch ${batchId}:`, error);
        
    } finally {
        axios.post("http://localhost:3000/api/file/internal/notify", { batchId }, {headers: { "x-internal-secret": process.env.INTERNAL_SECRET }})
        .catch(err => {
            console.error(`🚨 CRITICAL: Failed to notify S3 about completion of batch ${batchId}:`, err);
        });

        const failedOrUnprocessedCount = totalImages - successfulCount;
        
        if (failedOrUnprocessedCount > 0) {
            console.warn(`⚠️ ${failedOrUnprocessedCount} out of ${totalImages} images failed or were unprocessed for batch ${batchId}. Attempting refund for user ${userId}.`);
            await refundCredit(userId, failedOrUnprocessedCount).catch(err => {
                console.error(`🚨 CRITICAL: Failed to process refund for user ${userId}:`, err);
            });
        }
    }   
};

// (async () => {
//     try {
//         // await Ocr.deleteMany({ userId: "69cd28281fb0ad2f3ad613d3" });
//         const result = await User.find({ email: "ali@test.com" });
//         console.log(result);
//     } catch (error) {
//         console.log(error);
//     }
//     // const dummyFiles = [
//     //     { path: "path/to/dummy1.jpg" },
//     //     { path: "path/to/dummy2.jpg" }
//     // ];
//     // await runBottleneckProcessor("", "dummyBatchId", dummyFiles);
// })();

module.exports = { runBottleneckProcessor };