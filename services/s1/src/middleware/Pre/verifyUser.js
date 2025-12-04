// MIDDLEWARE LIKE gRPC FUNCTIONS


const {CatchAsync, logger, AppError} = require("@utils/require")
const verifyToken = require("@utils/handleJwt")

// Authentication Validation / verify User Middleware
const verifyUser = CatchAsync(async (call,callback) => {
    if(!call.request) throw new AppError("Invalid data")
    let {sessionCookie} = call.request

    ({userData, sessionCookie} = verifyToken(sessionCookie))
    
    callback(null, {ok: true, userData, sessionCookie})
})

module.exports = {
    verifyUser
}