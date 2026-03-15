
const jwt = require("jsonwebtoken")
const {randomBytes} = require("crypto")
const {promisify} = require("util")
const grpc = require("@grpc/grpc-js")

const {AppError} = require("@shared/utils/handler")
const {User} = require("@utils/require")
const path = require("path")

// IN JWT, USED A HYBRID TECHNIQUE, IN WHICH LONG TERM AND SHORT TERM TOKEN ARE UTILIZED
// AND EVERY SAME ACCOUNT ON MULTIPLE DEVICE UTILIZE SAME TOKEN 
// WHEN ANY DEVICE LOGOUT, ALL OTHER HAVE TO LOGOUT
// ALL DEVICE WILL USE SAME TOKEN WHICH FIRST DEVICE ON LOGIN RECEIVED

async function createSessionCookie(userData, sessionToken) {
    const randomBytePromise = promisify(randomBytes)
    sessionToken = sessionToken ?? (await randomBytePromise(10)).toString('hex')
    
    const payload = {
        userData: {
            id: userData.id,
            email: userData.email,
            name: userData.name,
        },
        sessionTime: Date.now(),
        sessionToken,
    };
    const jwtSign = promisify(jwt.sign)
    const token = await jwtSign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_MAIN_EXPIRY })
    return { sessionCookie: token, sessionToken };
}

// 1. Decode JWT token and verify if the token is expired or not
// 2. Verify time Value -> If statement for Time Value (yes: continue with, no: search in DB to verify)
//      if yes: return userData, if no: search in DB to verify refreshToken
// 3. if verify from DB, now update the sessionToken cookie with new sessionTime by creating new session token
// 4. then create new Cookie
// 4. RETURN userData and sessionCookie
async function verifyToken(sessionCookie){
    // 1
    const decoded = await promisify(jwt.verify)(sessionCookie, process.env.JWT_SECRET)
    if(!(decoded && decoded.userData)) throw new AppError("session is expired, login again", grpc.status.UNAUTHENTICATED)
    // 2
    if(decoded.sessionTime && Date.now() < (parseInt(decoded.sessionTime) + (60 * 1000))) return {userData: decoded.userData, sessionToken: null}
    // Session time is expired
    const user = await User.findById(decoded?.userData.id).select("sessionToken email name")
    if(!user) throw new AppError("user not found, login again", grpc.status.NOT_FOUND)
    else if(user.sessionToken !== decoded.sessionToken) throw new AppError("session verification failed, login again", grpc.status.UNAUTHENTICATED);
    // 4
    ({sessionCookie} = await createSessionCookie({
        id: user.id,
        email: user.email,
        name: user.name
    }, decoded.sessionToken))
    return {userData: decoded.userData, sessionCookie}
}

module.exports= {
    verifyToken,
    createSessionCookie
}