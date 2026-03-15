require("module-alias/register");

const {analyzeFile, countFiles} = require("@middleware/analyzeFile");
const {analyzeSubscription} = require("@middleware/verifyCost");
// const {processFile} = require("@service/ocr")

module.exports = {
    analyzeFile,
    countFiles,
    analyzeSubscription,
    // processFile
}
