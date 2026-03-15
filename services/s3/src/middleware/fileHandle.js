require("module-alias/register");

const multer = require('multer');
const {s2Client} = require("@util/require")
const { callClient } = require("@util/mwareUtil");
const { AppError, verifyNullish } = require("@shared/utils/Handler");
const { CatchAsync } = require("@util/errHandler")
const path = require('path');

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'temp/'),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/\s+/g, "-")}`)
});
const upload = multer({ storage });

const fileObj = async (files) => {
    if (!files || files.length === 0) throw new AppError("No files uploaded.", 400);
    return files.map(f => ({mimetype: f.mimetype, path: path.resolve(f.path)}));
}

const analyzeFiles = CatchAsync(async (req, res, next) => {
    req.grpcFiles = await fileObj(req.files);
    delete req.files;
    const analyzeResult = (await callClient(s2Client, "AnalyzeFile", { files: req.grpcFiles }));
    req.totalPages = analyzeResult.totalPages;
    // if file is pdf then assign converted files to grpcFiles for furthur processing
    if(req.grpcFiles[0].mimetype === 'application/pdf' && analyzeResult.processedFiles) req.grpcFiles = analyzeResult.processedFiles
    next();
})

const analyzeSubscription = CatchAsync(async (req, res, next) => {
    const {totalPages: cost, user: {id: userId}} = req;
    if(verifyNullish(cost, userId)) throw new AppError("Invalid data.", 500);

    const result = await callClient(s2Client, "AnalyzeSubscription", {userId, cost});
    if(!result.success) throw new AppError("Subscription validation failed.", 403);
    // assign totalPage and remainingCredits to res 
    Object.assign(res.locals, { 
        remainingCredits: result.remainingCredits, 
        totalPages: req.totalPages 
    });
    req.totalPages = undefined;
    next();
})

const countFiles = CatchAsync(async (req, res, next) => {
    console.log(s2Client)
    const result = await callClient(s2Client, "CountFiles", {});
    if (result.halt) throw new AppError("Too many files in the system. Please try again later.", 503);
    next();
})

module.exports= {upload, analyzeFiles, countFiles, analyzeSubscription}; 