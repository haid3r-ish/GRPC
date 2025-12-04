require("module-alias/register")
// export all, multiple time used, complex import  
module.exports = {
    // Prepared logger instance in shared
    logger: require("@shared/utils/EventHandle").pinoInstance(require("pino"),require.resolve("@root")),
    // User schema
    User: require("mongoose").model("User",require("@shared/utils/Model/user")),
    // User: require("@shared/utils/Model/user")(require("mongoose"),require("bcrypt")),
    // CatchAsync 
    CatchAsync: require("@shared/utils/EventHandle").CatchAsync,
    // AppError
    AppError: require("@shared/utils/EventHandle").AppError,
}