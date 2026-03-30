const express = require('express');
const router = express.Router();
const {upload, analyzeFiles, countFiles, analyzeSubscription} = require("@middleware/fileHandle")
const {protect, autoCleanup, verifyInternalRequest} = require("@middleware/protect")
const {processFiles} = require("@controller/s2")

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
    const { batchId } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); 

    // The function that runs when the processor finishes
    const onBatchComplete = (data) => {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
        res.end(); // Close connection from the server side
    };

    const eventName = `completed_${batchId}`;
    sseEvents.once(eventName, onBatchComplete);

    req.on('close', () => {
        sseEvents.removeListener(eventName, onBatchComplete);
    });
});

// router to get notified task done in s2
router.post("/internal/notify", verifyInternalRequest, (req,res) => {
    const {batchId} = req.body;

    sseEvents.emit(`completed_${batchId}`, {batchId})

    res.end();
})


// access doc route, on first access we will delete the entry from db 

module.exports = router;