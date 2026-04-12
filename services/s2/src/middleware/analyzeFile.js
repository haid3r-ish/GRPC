require("module-alias/register");

const fs = require('fs-extra');
const grpc = require("@grpc/grpc-js")
const path = require("path");
const util = require("util");
const exec = util.promisify(require('child_process').exec);

const {CatchAsync, AppError} = require("@shared/utils/handler")

const MAX_FILES_STORED = 50; // Max files to store for analysis
const DIR_PATH = path.dirname(require.resolve("@s3")) + "\\temp"; // Directory to store uploaded files for analysis
console.log("DIR_PATH: ", DIR_PATH)
const analyzeFile = CatchAsync(async (call, callback) => {
    let { files } = call.request;
    // total pages in current request
    let totalPages = 0;
    // check for valid files
    if (!files || files.length === 0) throw new AppError("No files provided for analysis.", grpc.status.INVALID_ARGUMENT);

    // PDF: Extract page count (upto 10 pages)
    if (files.length === 1 && files[0].mimetype === 'application/pdf') {
        // convert pdf into  images and also get page Count
        let convertedData = await pdfToImg(files[0].path); 
        totalPages = convertedData.totalPages;
        files = convertedData.files; 
        convertedData = undefined;   // free memory 
    }
    // IMAGES: Count number of images (up to 10)
    else if (files.every(f => f.mimetype && f.mimetype.startsWith('image/')) && files.length <= 10) {
        totalPages = files.length; 
        files = null
    }
    // validate totalPages before returning
    if(totalPages === 0) throw new AppError("Invalid file types. Only 1 PDF or up to 10 images allowed.", grpc.status.INVALID_ARGUMENT)
    callback(null, { totalPages, processedFiles: files });
})

// total file counting all server requests
// This is middleware function run on file upload endpoint to check if there are more than max file than halt furthur requests
const countFiles = CatchAsync(async (call, callback) => {
    // Count no of files in particular dir
    const files = await fs.readdir(DIR_PATH);
    // If more than 10 files
    if (files.length > MAX_FILES_STORED) {
        // Send signal to halt furthur request
        return callback(null, { halt: true })
    }
    callback(null, { halt: false })
})

async function pdfToImg(pdfPath) {
    // Pdf path
    const dirPath = path.dirname(pdfPath);
    const baseName = path.basename(pdfPath, path.extname(pdfPath))
    // outuput files name pattern
    const outputPattern = path.join(dirPath, `${baseName}-page-%d.png`);

    // command for ghostscript to convert pdf to png
    const gsCommand = `"$${process.env.GHOSTSCRIPT_PATH || "gs"}" -dSAFER -dBATCH -dNOPAUSE -sDEVICE=png16m -r300 -sOutputFile="${outputPattern}" "${pdfPath}"`;

    const { stdout } = await exec(gsCommand);
    const totalPages = [...stdout.matchAll(/Page (\d+)/g)].length;
    // delete the pdf 
    await fs.unlink(pdfPath).catch(() => {});
    // validate page count and return file paths
    if (totalPages === 0 || totalPages > 10) {
        // deletion done in middleware 
        throw new AppError("Invalid PDF file. Must have 1-10 pages.", grpc.status.INVALID_ARGUMENT);
    }
    // Make new array to return with path and mimetype
    const newFiles = [];
    for (let i = 1; i <= totalPages; i++) {
        newFiles.push({
            path: path.join(dirPath, `${baseName}-page-${i}.png`),
            mimetype: 'image/png'
        });
    }
    return {files: newFiles, totalPages};
} 

module.exports = {analyzeFile, countFiles}