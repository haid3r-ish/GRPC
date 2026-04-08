require("module-alias/register");

const express = require('express');
const passport = require('passport');

const authRouter = express.Router();
const userRouter = express.Router();

const s1Controller = require('@controller/s1');

const {protect} = require('@middleware/protect');

authRouter.post('/register', s1Controller.signup);
authRouter.post('/login', s1Controller.login);
authRouter.post('/forgot-password', s1Controller.requestPasswordReset);
authRouter.post('/reset-password', s1Controller.resetPassword);

// Google OAuth Routes
authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
authRouter.get('/google/callback', 
    passport.authenticate('google', { failureRedirect: '/api/auth/login' }),
    s1Controller.googleOAuthCallback
);
// authRouter.get('/google/url', s1Controller.googleOAuthURL);

authRouter.use(protect);

authRouter.post('/logout', s1Controller.logout);
authRouter.post('/change-password', s1Controller.changePassword);
// Subscription Route
authRouter.post('/check-subscription', s1Controller.checkSubscription);
authRouter.delete('/cancel-subscription', s1Controller.cancelSubscription);

userRouter.use(protect);

userRouter.route("/me")
.get(s1Controller.getProfile)
.put(s1Controller.updateProfile)
.delete(s1Controller.deleteAccount);



module.exports = { 
    authRouter, 
    userRouter ,
    subscriptionWebHook: s1Controller.subscriptionWebHook,
};