const mongoose = require("mongoose")
const bcrypt = require("bcrypt")
const grpc = require("@grpc/grpc-js")
const crypto = require("crypto")

const {logger, User} = require("@utils/require")
const {CatchAsync, AppError, verifyNullish, converge} = require("@shared/utils/handler")
const {createSessionCookie} = require("@utils/handleJwt")
const {sendEmail} = require("@utils/nodeMailer")

const jwt = require('jsonwebtoken'); // Make sure to import jwt

async function signupHelper(email, name, hashedPassword) {
    const user = await User.create({ email, name, password: hashedPassword });
    if (!user) throw new AppError("Issue in creating User", grpc.status.INTERNAL);
        
    logger.info({ userId: user._id, email: user.email }, "User Signed Up Successfully");
    
    let userData = { id: user._id.toString(), email: user.email, name: user.name };
    const { sessionCookie, sessionToken } = await createSessionCookie(userData, null);
    user.sessionToken = sessionToken;
    await user.save();

    const userPayload = {
        status: "SUCCESS",
        sessionCookie,
        userData: converge({id: user._id, email: user.email, name: user.name})
    };
    return userPayload;
}

const signup = CatchAsync(async (call, callback) => {
    // A. Validation
    const { email, password, name } = call.request;
    if (verifyNullish(email, password, name)) throw new AppError("Provide valid data", grpc.status.INVALID_ARGUMENT);

    // B. Check Existing
    const existing = await User.findOne({ email });
    if (existing) throw new AppError("Email already registered", grpc.status.ALREADY_EXISTS);

    const hashedPassword = await bcrypt.hash(password, 12);
    if (!hashedPassword) throw new AppError("Issue in hashing password", grpc.status.INTERNAL);

    // Dynamic flow based on email verification via otp
    if (false) {
        // 1. Generate a random 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        
        // 2. Hash the OTP so the frontend can't read it from the JWT
        const hashedOtp = crypto.createHash('sha256').update(otp).digest('hex');

        // 3. Put the user data AND the hashed OTP into the JWT
        const pendingSignupToken = jwt.sign(
            { email, name, password: hashedPassword, otp: hashedOtp },
            process.env.JWT_SECRET,
            { expiresIn: '15m' } // Token expires in 15 mins
        );

        // TODO: Email the RAW 'otp' to the user here
        logger.info({ email, otp }, "OTP generated and mock-emailed.");

        // 4. Return the JWT to the frontend so it can hold onto it
        return callback(null, { 
            status: "PENDING_OTP", 
            message: "Enter the 6-digit code sent to your email.",
            pendingToken: pendingSignupToken 
        });

    }
    const userPayload = await signupHelper(email, name, hashedPassword);
    return callback(null, userPayload);
});

const verifySignupOtp = CatchAsync(async (call, callback) => {
    const { token, userOtp } = call.request;
    if (verifyNullish(token, userOtp)) throw new AppError("Token and OTP required", grpc.status.INVALID_ARGUMENT);

    // 1. Verify the JWT isn't expired or tampered with
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 2. Hash the OTP the user just typed in
    const hashedUserInput = crypto.createHash('sha256').update(userOtp.toString()).digest('hex');

    // 3. Compare it to the hashed OTP stored inside the JWT
    if (hashedUserInput !== decoded.otp) {
        throw new AppError("Invalid OTP", grpc.status.UNAUTHENTICATED);
    }

    // 4. Double check the email hasn't been taken in the last 15 mins
    const existing = await User.findOne({ email: decoded.email });
    if (existing) throw new AppError("Email already registered", grpc.status.ALREADY_EXISTS);

    // 5. SUCCESS! Save the user to the database
    const user = await User.create({ 
        email: decoded.email, 
        name: decoded.name, 
        password: decoded.password // Already hashed from Step 1!
    });

    // 6. Generate final session cookies
    let userData = { id: user._id.toString(), email: user.email, name: user.name };
    const { sessionCookie, sessionToken } = await createSessionCookie(userData, null);
    user.sessionToken = sessionToken;
    await user.save();

    logger.info({ userId: user._id }, "User Verified OTP and Signed Up");

    callback(null, {
        status: "SUCCESS",
        sessionCookie,
        userData: converge({id: user._id, email: user.email, name: user.name})
    });
});

const login = CatchAsync(async (call, callback) => {
    const { email, password } = call.request;
    if (verifyNullish(email, password)) throw new AppError("Provide valid data", grpc.status.INVALID_ARGUMENT);

    const user = await User.findOne({ email }).select("name email _id sessionToken +password");
    if (!user ) throw new AppError("Email or Password is incorrect", grpc.status.UNAUTHENTICATED);

    // password verfication
    const match = await user.correctPassword(password);
    if (!match) throw new AppError("Email or Password is incorrect", grpc.status.UNAUTHENTICATED);
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

    const match = await user.correctPassword(oldPassword);
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

// GOOGLE OAUTH
const googleOAuthCallback = CatchAsync(async (call, callback) => {
    const { googleId, email, name, profilePicture } = call.request;

    if (verifyNullish(googleId, email, name)) {
        throw new AppError("Missing OAuth data", grpc.status.INVALID_ARGUMENT);
    }

    // Check if user exists by providerId or email
    let user = await User.findOne({ 
        $or: [{ providerId: googleId }, { email }] 
    });
    let needSave = false;  
    if (!user) {
        // Create new user
        user = await User.create({
            email,
            name,
            provider: "google",
            providerId: googleId,
            profilePicture: profilePicture || null,
            password: null // No password for OAuth users
        });

        logger.info({ userId: user._id, email }, "User Created via Google OAuth");
    } else {
        if (!user.providerId) {
            user.provider = "google";
            user.providerId = googleId;
            if (!user.profilePicture && profilePicture) user.profilePicture = profilePicture;
            needSave = true;
        }
        logger.info({ userId: user._id, email }, "User Logged In via Google OAuth");
    }

    // Create session
    let userData = { id: user._id.toString(), email: user.email, name: user.name };
    let sessionCookie = null;
    let sessionToken = null;

    if (!user.sessionToken) {
        ({ sessionCookie, sessionToken } = await createSessionCookie(userData, null));
        user.sessionToken = sessionToken;
        needSave = true;
    } else {
        ({ sessionCookie } = await createSessionCookie(userData, user.sessionToken));
    }

    if (needSave) await user.save();

    const userPayload = {
        sessionCookie,
        userData: converge({ id: user._id, email: user.email, name: user.name, profilePicture: user.profilePicture })
    };

    callback(null, userPayload);
});

const verifyGoogleToken = CatchAsync(async (call, callback) => {
    const { token } = call.request;

    if (verifyNullish(token)) {
        throw new AppError("Token required", grpc.status.INVALID_ARGUMENT);
    }

    // This would use google auth library to verify token
    // For now, returning verified status
    callback(null, { verified: true, token });
});

module.exports = {
    login,
    signup,
    resetPassword,
    requestPasswordReset,
    changePassword,
    logout,
    googleOAuthCallback,
    verifyGoogleToken
}