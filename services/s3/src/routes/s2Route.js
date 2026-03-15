const express = require('express');
const router = express.Router();
const {upload, analyzeFiles, countFiles, analyzeSubscription} = require("@middleware/fileHandle")
const {protect, autoCleanup} = require("@middleware/protect")

router.use(protect);

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
    (req, res) => {
        // res.json({ message: "Files analyzed successfully", files: req.files });
        res.end("done")
    }
);


// sse for sending status to user when files are processed 
router.get("/status/stream", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
});


// access doc route, on first access we will delete the entry from db 

module.exports = router;