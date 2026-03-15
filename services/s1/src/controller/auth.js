const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const grpc = require("@grpc/grpc-js")
const crypto = require("crypto")

const {logger, User} = require("@utils/require")
const {CatchAsync, AppError, verifyNullish, converge} = require("@shared/utils/handler")
const {createSessionCookie} = require("@utils/handleJwt")

const signup = CatchAsync(async (call, callback) => {
    // A. Validation
    const { email, password, name } = call.request;
    if (verifyNullish(email, password, name)) throw new AppError("Provide valid data", grpc.status.INVALID_ARGUMENT);

    // B. Check Existing
    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email already registered", grpc.status.ALREADY_EXISTS);

    const hashedPassword = await bcrypt.hash(password, 12);
    if(!hashedPassword) throw new AppError("Issue in hashing password", grpc.status.INTERNAL)

    const user = await User.create({ email, name, password: hashedPassword }).select("name email _id");
    if (!user) throw new AppError("Issue in creating User", grpc.status.INTERNAL);
        
    // D. Log Success (Structured)
    logger.info({ userId: user._id, email: user.email }, "User Signed Up Successfully");
    // E. Session & Response
    let userData = { id: user._id.toString(), email: user.email, name: user.name };
    const { sessionCookie, sessionToken } = await createSessionCookie(userData, null);
    user.sessionToken = sessionToken;
    await user.save();

    const userPayload = {
        sessionCookie,
        userData: converge({id: user._id, email: user.email, name: user.name})
    }

    callback(null, userPayload);
});

const login = CatchAsync(async (call, callback) => {
    const { email, password } = call.request;
    if (verifyNullish(email, password)) throw new AppError("Provide valid data", grpc.status.INVALID_ARGUMENT);

    const user = await User.findOne({ email }).select("name email _id sessionToken");
    if (!user ) throw new AppError("Email or Password is incorrect", grpc.status.UNAUTHENTICATED);

    // Session Logic
    let userData = { id: user._id.toString(), email: user.email, name: user.name };
    let sessionCookie = null;
    let sessionToken = null;
    
    if (!user.sessionToken) {
        ({ sessionCookie, sessionToken } = await createSessionCookie(userData, null));
        user.sessionToken = sessionToken;
        await user.save();
    } else {
        ({ sessionCookie } = await createSessionCookie(userData, user.sessionToken));
    }
    
    logger.info({ userId: user._id }, "User Logged In");

    const userPayload = converge(userData);
    callback(null, { userData: userPayload, sessionCookie });
});

const requestPasswordReset = CatchAsync(async (call, callback) => {
    const { email } = call.request;
    if (verifyNullish(email)) throw new AppError("Email required", grpc.status.INVALID_ARGUMENT);

    const user = await User.findOne({ email });
    if (!user) throw new AppError("Email Not Found", grpc.status.NOT_FOUND);

    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetToken = resetToken;
    user.resetTokenExpiry = Date.now() + 15 * 60 * 1000;
    await user.save();

    logger.info({ userId: user._id, email }, "Password Reset Requested");

    callback(null, { resetToken });
});

const resetPassword = CatchAsync(async (call, callback) => {
    const { resetToken, newPassword } = call.request;
    if (verifyNullish(resetToken, newPassword)) throw new AppError("Missing Data", grpc.status.INVALID_ARGUMENT);

    const user = await User.findOne({ 
        resetToken, 
        resetTokenExpiry: { $gt: Date.now() } 
    });

    if (!user) throw new AppError("Invalid or expired reset token", grpc.status.INVALID_ARGUMENT);

    user.password = await bcrypt.hash(newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;

    const { sessionCookie, sessionToken } = await createSessionCookie({
        id: user._id,
        name: user.name,
        email: user.email
    },null );
    user.sessionToken = sessionToken;
    await user.save();
    logger.info({ userId: user._id }, "Password Reset Successful");

    callback(null, { status: "Password Reset Successfully", sessionCookie });
});

const changePassword = CatchAsync(async (call, callback) => {
    const { userId, oldPassword, newPassword } = call.request;
    if (verifyNullish(userId, oldPassword, newPassword)) {
        throw new AppError("Missing Data", grpc.status.INVALID_ARGUMENT);
    }

    const user = await User.findById(userId).select('+password');
    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND);

    const match = await bcrypt.compare(oldPassword, user.password);
    if (!match) throw new AppError("Old password Incorrect", grpc.status.INVALID_ARGUMENT);

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();
    
    logger.info({ userId: user._id }, "Password Changed");

    callback(null, { message: "Password changed successfully" });
});

const logout = CatchAsync(async (call, callback) => {
    const { userId } = call.request;

    if (verifyNullish(userId)) {
        throw new AppError("User ID required", grpc.status.INVALID_ARGUMENT);
    }

    await User.findByIdAndUpdate(userId, { sessionToken: null });

    callback(null, { message: "Logged out successfully" });
});

module.exports = {
    login,
    signup,
    resetPassword,
    requestPasswordReset,
    changePassword,
    logout
}