require("module-alias/register");

const express = require('express');

const authRouter = express.Router();
const userRouter = express.Router();

const s1Controller = require('@controller/s1');

const {protect} = require('@middleware/protect');

authRouter.post('/register', s1Controller.signup);
authRouter.post('/login', s1Controller.login);
authRouter.post('/forgot-password', s1Controller.requestPasswordReset);
authRouter.post('/reset-password', s1Controller.resetPassword);

authRouter.use(protect);

authRouter.post('/logout', s1Controller.logout);
authRouter.post('/change-password', s1Controller.changePassword);
authRouter.get('/check', (req, res) => res.json({ ok: true, user: req.user }));
// Subscription Route
authRouter.post('/check-subscription', s1Controller.checkSubscription);
authRouter.post('/cancel-subscription', s1Controller.cancelSubscription);

userRouter.use(protect);

userRouter.get('/me', s1Controller.getProfile);
userRouter.put('/profile', s1Controller.updateProfile);
userRouter.delete('/account', s1Controller.deleteAccount);



module.exports = { 
    authRouter, 
    userRouter ,
    subscriptionWebHook: s1Controller.subscriptionWebHook,
};