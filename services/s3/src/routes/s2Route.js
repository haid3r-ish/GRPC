const express = require('express');
const router = express.Router();
const EventEmitter = require('events');

const {upload, analyzeFiles, countFiles, analyzeSubscription} = require("@middleware/fileHandle")
const {protect, autoCleanup, verifyInternalRequest} = require("@middleware/protect")
const {processFiles} = require("@controller/s2")

// router to get notified task done in s2
router.post("/internal/notify", (req, res) => {
    const { batchId } = req.body;
    console.log(`[SSE: Notify] 📥 Received webhook from s2 for batch: ${batchId}`);

    if (!batchId) {
        console.error(`[SSE: Notify] ❌ ERROR: Missing batchId in request body`);
        return res.status(400).json({ error: "batchId is required" });
    }

    const eventName = `completed_${batchId}`;
    
    // PRO DEBUG MOVE: Check if the frontend is actually still listening!
    const listenersCount = sseEvents.listenerCount(eventName);
    if (listenersCount === 0) {
        console.log(`[SSE: Notify] ⚠️ WARNING: Emitting '${eventName}', but ZERO clients are listening. (Did the frontend disconnect early?)`);
    } else {
        console.log(`[SSE: Notify] 📢 Emitting '${eventName}' to ${listenersCount} active listener(s).`);
    }

    // Fire the event
    sseEvents.emit(eventName, { batchId });

    // Always send a proper HTTP status code instead of just res.end()
    res.end()
    console.log(`[SSE: Notify] 📤 Replied to s2 with 200 OK`);
});

router.use(protect);

const sseEvents = new EventEmitter();

// request to process the files
// first use multer middleware , with limit of 10 files
// countFile(M): seeking total number of files stored in system 
// analyzeFiles(M): checking file type and if pdf then convert into imgs (imgs and pdfs), returning total pages and file obj
// analyzeSubscription(M): validating subscription(by changing db values on expiry), incrementing free fund and validating cost with deduction
// then call processFile function of grpc to process the files and send response to user
router.post(
    '/process', 
    upload.array('documents', 10),
    autoCleanup,
    countFiles,
    analyzeFiles,
    analyzeSubscription,
    processFiles
);


// sse for sending status to user when files are processed 
router.get('/stream/:batchId', (req, res) => {
    const batchId = req.params.batchId.replace('batchId=', '');
    console.log(`[SSE: Stream] 🟢 Client connected for batch: ${batchId}`);
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 
    console.log(`[SSE: Stream] 🌊 Headers sent. Stream open for ${batchId}`);

    // The function that runs when the processor finishes
    const onBatchComplete = (data) => {
        console.log(`[SSE: Stream] ⚡ Event caught! Pushing data to client for ${batchId}`);
        res.write(`data: ${JSON.stringify({ batchId })}\n\n`);
        res.end() 
        console.log(`[SSE: Stream] ✅ Connection gracefully closed by server for ${batchId}`);
    };

    const eventName = `completed_${batchId}`;
    sseEvents.once(eventName, onBatchComplete);
    console.log(`[SSE: Stream] 🎧 Listening for internal event: '${eventName}'`);

    // Handle client disconnecting (closing tab, network drop)
    req.on('close', () => {
        console.log(`[SSE: Stream] 🔴 Client dropped the connection early for ${batchId}`);
        sseEvents.removeListener(eventName, onBatchComplete);
        console.log(`[SSE: Stream] 🧹 Listener removed for '${eventName}' to prevent memory leaks`);
    });
});


// access doc route, on first access we will delete the entry from db 

module.exports = router;