require("module-alias/register");

const {analyzeFile, countFiles} = require("@middleware/analyzeFile");
const {analyzeSubscription, refundCall} = require("@middleware/verifyCost");
const {ProcessFile, GetDoc, GetAllDocs, GetHistory} = require("@controller/ocr")

module.exports = {
    analyzeFile,
    countFiles,
    analyzeSubscription,
    ProcessFile,
    refundCall,
    GetDoc,
    GetAllDocs,
    GetHistory
}
