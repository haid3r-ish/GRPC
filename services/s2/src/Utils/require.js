require("module-alias/register")
// export all, multiple time used, complex import  
const mongoose = require("mongoose");

const UserSchema = require("@shared/utils/Model/user");
const SubscriptionSchema = require("@shared/utils/Model/subscription");
const OcrSchema = require("@shared/utils/Model/job");

module.exports = {
    // Prepared logger instance in shared
    logger: require("@shared/utils/handler").pinoInstance(require("pino"),require.resolve("@root")),
    
    /// MODELS ///
    
    // User schema
    User: mongoose.model("User",UserSchema(mongoose)),
    // subscription schema
    Subscription: mongoose.model("Subscription",SubscriptionSchema(mongoose)),
    // OCR Batch schema
    Ocr: mongoose.model("OcrBatch", OcrSchema(mongoose))
}