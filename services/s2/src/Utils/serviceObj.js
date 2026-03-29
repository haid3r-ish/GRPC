require("module-alias/register");

const {analyzeFile, countFiles} = require("@middleware/analyzeFile");
const {analyzeSubscription, refundCall} = require("@middleware/verifyCost");
const {ProcessFile} = require("@controller/ocr")

module.exports = {
    analyzeFile,
    countFiles,
    analyzeSubscription,
    ProcessFile,
    refundCall
}
