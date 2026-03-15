// MIDDLEWARE LIKE gRPC FUNCTIONS
require("module-alias/register")
const grpc = require("@grpc/grpc-js")

const {logger} = require("@utils/require")
const {CatchAsync, AppError, diverge} = require("@shared/utils/handler")
const {verifyToken} = require("@utils/handleJwt")



// Authentication Validation / verify User Middleware
const verifyUser = CatchAsync(async (call,callback) => {
    if(!call.request) throw new AppError("Invalid data", grpc.status.INVALID_ARGUMENT)
    let {sessionCookie} = call.request
    let userData = null;
    ({userData, sessionCookie} = await verifyToken(sessionCookie))
    callback(null, {userData, sessionCookie})
})

module.exports = {
    verifyUser
}