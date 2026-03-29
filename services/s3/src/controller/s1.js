require("module-alias/register")

const { CatchAsync } = require("@util/errHandler") // Ensure you have this
const { s1Auth, s1User, s1Subscription } = require("@util/require") // Import both clients
const { callClient } = require("@util/mwareUtil")
const { verifyNullish, AppError, diverge } = require("@shared/utils/handler")

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 
};

const signup = CatchAsync(async (req, res) => {
    const { name, email, password } = req.body;
    if (verifyNullish(name, email, password)) throw new AppError("Invalid Arguments", 400);

    const result = await callClient(s1Auth, "Signup", { email, password, name });

    if (!result.sessionCookie) throw new AppError("Signup failed", 500);

    res.cookie("session", result.sessionCookie, COOKIE_OPTIONS);

    res.status(201).json({ user: diverge(result.userData)});
});

const login = CatchAsync(async (req, res) => {
    const { email, password } = req.body;
    if (verifyNullish(email, password)) throw new AppError("Invalid Arguments", 400);

    const result = await callClient(s1Auth, "Login", { email, password });
    

    if (!result.sessionCookie) throw new AppError("Login failed", 500);

    res.cookie("session", result.sessionCookie, COOKIE_OPTIONS);

    res.status(200).json({ user: diverge(result.userData) });
});

const logout = CatchAsync(async (req, res) => {
    // If user is logged in (via protect middleware), we have req.user.id
    // If not, we just clear cookie.
    if (req.user && req.user.id) {
        await callClient(s1Auth, "Logout", { userId: req.user.id })
    }

    res.clearCookie("session", COOKIE_OPTIONS);
    res.status(200).json({ message: "Successfully logged out" });
});

const changePassword = CatchAsync(async (req, res) => {
    // Requires 'protect' middleware to supply req.user.id
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id; 

    if (verifyNullish(oldPassword, newPassword)) throw new AppError("Invalid Arguments", 400);

    await callClient(s1Auth, "ChangePassword", { userId, oldPassword, newPassword });

    res.status(200).json({ message: "Password Changed" });
});

const requestPasswordReset = CatchAsync(async (req, res) => {
    const { email } = req.body;
    if (verifyNullish(email)) throw new AppError("Email required", 400);

    const result = await callClient(s1Auth, "RequestPasswordReset", { email });

    res.status(200).json({ message: "Check email for token", resetToken: result.resetToken });
});

const resetPassword = CatchAsync(async (req, res) => {
    const { resetToken, newPassword } = req.body;
    if (verifyNullish(resetToken, newPassword)) throw new AppError("Invalid Arguments", 400);

    const result = await callClient(s1Auth, "ResetPassword", { resetToken, newPassword });

    if (!result.sessionCookie) throw new AppError("Password reset failed", 500);

    res.cookie("session", result.sessionCookie, COOKIE_OPTIONS);

    res.status(200).json({ message: "Password Reset Successful" });
});


// =======================
// USER CONTROLLERS
// =======================

const getProfile = CatchAsync(async (req, res) => {
    // Uses ID from middleware
    const userId = req.user.id;

    const result = await callClient(s1User, "GetProfile", { userId });

    res.status(200).json({ 
        user: { id: result.userId, name: result.name, email: result.email } 
    });
});

const updateProfile = CatchAsync(async (req, res) => {
    const userId = req.user.id;
    const { name, email } = req.body; // Allow updating name or email

    const result = await callClient(s1User, "UpdateProfile", { userId, name, email });

    res.status(200).json({ 
        message: "Profile Updated",
        user: { id: result.userId, name: result.name, email: result.email }
    });
});

const deleteAccount = CatchAsync(async (req, res) => {
    const userId = req.user.id;

    await callClient(s1User, "DeleteAccount", { userId });

    // Clear cookie since account is gone
    res.clearCookie("session", COOKIE_OPTIONS);

    res.status(200).json({ message: "Account deleted" });
});

/// SUBSCRIPTION CONTROLLERS ///

const checkSubscription = CatchAsync(async (req, res) => {
    const { plan } = req.body;
    const userId = req.user.id; 
    if (verifyNullish(userId, plan)) throw new AppError("Missing userId or plan", 400);

    const {url} = await callClient(s1Subscription, "CheckSubscription", { userId, plan });

    res.status(200).json({ url });
});

const cancelSubscription = CatchAsync(async (req, res) => {
    const userId = req.user.id; 
    if (verifyNullish(userId)) throw new AppError("Missing userId", 400);

    await callClient(s1Subscription, "CancelSubscription", { userId });

    res.status(200).json({ message: "Subscription cancelled" });
});

const subscriptionWebHook = CatchAsync(async (req, res) => {
    const signature = req.headers['stripe-signature']
    await callClient(s1Subscription, "SubscriptionWebHook", { signature, body: req.body });
    res.status(200).json({ received: true });
});

// =======================
// GOOGLE OAUTH
// =======================

const googleOAuthCallback = CatchAsync(async (req, res) => {
    const { googleId, email, name, profilePicture } = req.user || {};
    
    if (!googleId || !email) {
        throw new AppError("Missing OAuth data", 400);
    }
    console.log("run")
    const result = await callClient(s1Auth, "googleOAuthCallback", { 
        googleId, 
        email, 
        name, 
        profilePicture 
    });

    if (!result.sessionCookie) throw new AppError("OAuth login failed", 500);

    res.cookie("session", result.sessionCookie, COOKIE_OPTIONS);

    res.status(200).json({ 
        user: diverge(result.userData),
        message: "Google authentication successful"
    });
});

const googleOAuthURL = CatchAsync(async (req, res) => {
    // This returns the Google OAuth consent screen URL
    // In production, this should construct the proper OAuth URL
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const redirectUri = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5173/auth/google/callback';
    const scope = encodeURIComponent('profile email');
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scope}&response_type=code`;
    
    res.status(200).json({ url: oauthUrl });
});

module.exports = {
    // Auth
    signup, login, logout, changePassword, requestPasswordReset, resetPassword,
    // Google OAuth
    googleOAuthCallback, googleOAuthURL,
    // User
    getProfile, updateProfile, deleteAccount,
    // Subscription
    checkSubscription, subscriptionWebHook, cancelSubscription
}