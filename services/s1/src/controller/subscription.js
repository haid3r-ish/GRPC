require("module-alias/register");

const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const grpc = require("@grpc/grpc-js");

const {Subscription, User} = require("@utils/require");
const {CatchAsync, AppError, verifyNullish} = require("@shared/utils/handler")
const proThreshold = require("@shared/utils/exports").Threshold.proTokens;

// Check and Apply Subscription Logic 
const checkSubscription = CatchAsync(async (call, callback) => {
    const {userId, plan} = call.request;
    if (verifyNullish(userId, plan)) throw new AppError("Missing userId or plan", grpc.status.INVALID_ARGUMENT);

    // Check if user already has an active subscription
    const existingSub = await Subscription.exists({ userId, active: true });
    if (existingSub) throw new AppError("User already has an active subscription", grpc.status.ALREADY_EXISTS);

    // select PriceId based on plan
    const pirceId = plan === "pro" ? process.env.STRIPE_PRO_PRICE_ID : process.env.STRIPE_ENTERPRISE_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: "payment",
        line_items: [{price: pirceId, quantity: 1}],
        client_reference_id: userId,
        success_url: `http://localhost:3000/success.html`,
        cancel_url: `http://localhost:3000/cancel.html`,
        metadata: {
            plan
        }
    });

    if (!session || !session.url) throw new AppError("Failed to create Stripe session", grpc.status.INTERNAL);
 
    callback(null, { url: session.url });

})

// Cancel Subscription Logic
const cancelSubscription = CatchAsync(async (call, callback) => {
    const {userId} = call.request;
    if (verifyNullish(userId)) throw new AppError("Missing userId", grpc.status.INVALID_ARGUMENT);
    const sub = await Subscription.updateOne({ userId, active: true }, {
        $set: {
            active: false,
            endDate: undefined,
            startDate: undefined,
            plan: undefined
        }
    });
    if (sub.nModified === 0) throw new AppError("No active subscription found", grpc.status.NOT_FOUND);
    // Update database
    await User.updateOne({ _id: userId }, { $set: { proTokens: 0 } });

    callback(null, { message: "Subscription cancelled successfully" });
})

const subscriptionWebHook = CatchAsync(async (call, callback) => {
    const {signature, body} = call. request
    const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    if (!event || !event.type) throw new AppError("Failed to construct Stripe event", grpc.status.INVALID_ARGUMENT);

    if (event.type === 'checkout.session.completed') {
        const {client_reference_id: userId, metadata: {plan: planType}} = event.data.object;
        webHookPostWork(userId, planType);
    }


    callback(null, { received: true });
})

module.exports = {
    checkSubscription,
    subscriptionWebHook,
    cancelSubscription
}

// HELPER FUNCTIONS

async function webHookPostWork (userId, planType) {
    const now = new Date();
    const nextMonth = new Date(now);
    nextMonth.setMonth(now.getMonth() + 1);
    //Take User and update its databse
    const [userResult, subResult] = await Promise.all([
        User.updateOne(
            { _id: userId },
            { $set: { proTokens: proThreshold[planType] } }
        ),
        Subscription.updateOne(
            { userId: userId },
            {
                $set: {
                    plan: planType,
                    active: true,
                    startDate: now,   
                    endDate: nextMonth  
                }
            },
            { upsert: true } 
        )
    ]);
    // validate database update results
    if (!subResult.acknowledged || !userResult.acknowledged) {
        throw new AppError("CRITICAL: Failed to update database after webhook!", grpc.status.INTERNAL);
    }
}