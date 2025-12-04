const mongoose = require("mongoose")
const bcrypt = require("bcrypt")

const {CatchAsync, logger, AppError,User} = require("@utils/require")
const {createSessionCookie} = require("@utils/handleJwt")

const signup = CatchAsync(async (call,callback) => {
    if(!call.request) throw new AppError("Provided valid data")
    const { email, password, name } = call.request;
    const existing = await User.findOne({ email });
    if(existing && existing.length !== 0) throw new AppError("Email already registered")
        
    const hashed = await bcrypt.hash(password, 10);
    if(!hashed) throw new AppError("Issue in hashing the password")
        
    const user = await User.create({ email, name, password: hashed });
    if(!user) throw new AppError("Issue in creating new User")
        
    const { sessionCookie, sessionToken } = await createSessionCookie(user, null);
    user.sessionToken = sessionToken;
    await user.save();

    callback(null, { userData: user._id.toString(), sessionCookie });
})

// 1. check if user exists or not 
// 2. check whether this user already have a session token or not
//      if not then create token
const login = CatchAsync(async (call,callback) => {
    if(!call.request) throw new AppError("provided valid data")
    const { email, password } = call.request;
    // 1
    const user = await User.findOne({ email }).select("+password");
    if(!(user && await user.correctPassword(password,user.password))) throw new AppError("Email or Password is incorrect")
    // 2
    let userData = {id: user._id, email: user.email, name: user.name}, sessionCookie = null, sessionToken = null
    if(!user.sessionToken) {
        ({sessionCookie, sessionToken} = createSessionCookie(userData, null))
        user.sessionToken = sessionToken
        await user.save()
    } else {
        ({sessionCookie} = createSessionCookie(userData, user.sessionToken))
    }

    callback(null, { userData: {id: user._id}, sessionCookie });
})

// request for password reset(forgotten passsword)
// 1. check whether user exist or not( if not: then give error to signup )
// 2. if yes: create token and update db 
// 3. return that token 
const requestPasswordReset = CatchAsync(async (call,callback)=>{
    const { email } = call.request;
    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email Not Found")

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();

    callback(null, { resetToken });
})

// Now Post request to give new reseteed password
// 1. check whether user exist or not(USING EMAIL TAKEN FROM FRONTEND FROM PREVOUS CALL)
const resetPassword = CatchAsync(async(call,callback)=>{
    const { resetToken, newPassword, email } = call.request;
    const user = await User.findOne({ email, resetToken, resetTokenExpiry: { $gt: Date.now() } });
    if (!user) return callback({ code: 5, message: "Invalid or expired reset token" });

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;

    const { token, refreshToken } = createToken(user._id);
    user.refreshToken = refreshToken;
    await user.save();

    callback(null, { token, refreshToken });
})
3
const changePassword = CatchAsync(async (call,callback) => {
    const { userId, oldPassword, newPassword } = call.request;
    const user = await User.findById(userId);
    if (!user) throw new AppError("Issue in finding User")

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) throw new AppError("Old password Incorrect")

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    callback(null, { message: "Password changed successfully" });
})



module.exports = {
    login,
    signup,
    resetPassword,
    requestPasswordReset,
    changePassword
}