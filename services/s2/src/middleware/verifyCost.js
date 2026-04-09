require("module-alias/register");

const grpc = require("@grpc/grpc-js");

const {logger, User, Subscription} = require("@utils/require")
const {CatchAsync, AppError, verifyNullish} = require("@shared/utils/handler");
const freeThreshold = require("@shared/utils/exports").Threshold.freeTokens;

const analyzeSubscription = CatchAsync(async (call, callback) => {
    const {userId, cost} = call.request;
    if (verifyNullish(userId, cost)) throw new AppError("Missing required fields: userId and cost", grpc.status.INVALID_ARGUMENT);
    // find user and populate subscription
    let user = await User.findById(userId).select("proTokens freeTokens lastDailyReset")
    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND);
    user.subscription = await Subscription.findOne({userId: userId, active: true}).select("plan endDate startDate active")
    // validate subscription and get total credit
    const totalCredit = await validateSubscription(user);
    if (totalCredit < cost) {
        await user.save();
        throw new AppError("Insufficient credits", grpc.status.PERMISSION_DENIED);
    }

    // deduct credit
    deductCredit(user, cost);
    await user.save();

    callback(null, { success: true, remainingCredits: totalCredit - cost });
})

// purpose is to increment/validate free fund and check for subscription
const validateSubscription = async (user) => {
    // verify subscription status and update user if subscription has expired
    if (user.subscription &&
        user.subscription.active){
        if (user.subscription.endDate < new Date()) {
            // User Subscription Changes
            user.subscription.active = false;
            user.subscription.endDate = undefined;
            user.subscription.startDate = undefined;
            user.subscription.plan = undefined;
            await user.subscription.save();
            // User Changes
            user.proTokens = 0;
        }
    } else user.proTokens = 0; // if no active subscription ensure proTokens is 0

    const todayString = new Date().toDateString(); 
    const lastResetString = user.lastDailyReset ? user.lastDailyReset.toDateString() : "";
    // verify daily reset token according to subscription plan
    if (todayString !== lastResetString) {
        user.freeTokens = freeThreshold[user.subscription?.plan] || freeThreshold.free;
        user.lastDailyReset = new Date();
    }

    logger.info(`User ${user._id} has credits (Pro: ${(user.proTokens || 0)}, Free: ${user.freeTokens})`);
    // Returning total credits
    return (user.proTokens || 0)  + user.freeTokens;
}

const refundCall = CatchAsync(async (call, callback) => {
    const {userId, amount} = call.request;
    if (verifyNullish(userId, amount)) throw new AppError("Missing required fields: userId and amount", grpc.status.INVALID_ARGUMENT);

    await refundCredit(userId, amount);
    callback(null, {});
});

const deductCredit = (user, cost) => {
    // deduct cost from user.free Tokens first, then from user.proTokens if freeTokens are insufficient
    const deductProTokens = Math.max(0, cost - user.freeTokens);
    user.freeTokens = Math.max(0, user.freeTokens - cost);
    // Then easily deduct remaining cost from proTokens
    user.proTokens -= deductProTokens
    logger.info(`Deducted ${cost} credits from user ${user._id}. Remaining credits: ${user.freeTokens + (user.proTokens || 0)}`);
}

const refundCredit = async (userId, amount) => {
    const subscription = await Subscription.exists({userId: userId, active: true});
    const change = subscription ? { proTokens: amount } : { freeTokens: amount };
    const updateResult = await User.updateOne({_id: userId}, {$inc: change});
    if (updateResult.matchedCount === 0) throw new AppError("User not found", grpc.status.NOT_FOUND);
};


// (async () => {
//     try {
//         // await Ocr.deleteMany({ userId: "69cd28281fb0ad2f3ad613d3" });
//         const result = await User.find({ email: "ali@test.com" });
//         console.log(result);
//     } catch (error) {
//         console.log(error);
//     }
// })();

module.exports = {analyzeSubscription, refundCall, refundCredit}