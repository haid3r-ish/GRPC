require("module-alias/register")

const {User, logger, Subcription} = require("@utils/require")
const {CatchAsync, AppError} = require("@shared/utils/handler")

const getProfile = CatchAsync(async(call,callback) => {
    const { userId } = call.request;
    const user = await User.findById(userId)
                .select("name email profilePicture proTokens freeTokens lastDailyReset").lean();
    const subscription = await Subcription.findOne({ userId, active: true })
                .select("plan endDate").lean();    

    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND)
    console.log("Fetched user profile:", user, subscription);
    callback(null, { userId: user._id.toString(), name: user.name, email: user.email });
})

const updateProfile = CatchAsync(async(call,callback) => {
    const { userId, name, email } = call.request;
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND)

    user.name = name || user.name;
    user.email = email || user.email;
    await user.save();

    callback(null, { userId: user._id.toString(), name: user.name, email: user.email });
})

const deleteAccount = CatchAsync(async(call,callback) => {
    const { userId } = call.request;
    await User.findByIdAndDelete(userId);
        
    callback(null, { message: "User deleted successfully" });
})

const checkQuota = async (call, callback) => {
    const { userId } = call.request;
    const FREE_LIMIT = 10;
    
    let user = await User.findById(userId);
    if (!user) return callback(new Error("User not found"));

    let isModified = false;
    const now = new Date();
    const todayStart = new Date().setHours(0,0,0,0);

    // --- LOGIC 1: THE EXPIRY GUILLOTINE ---
    // If Pro Plan has expired, we FORCE reset them to Free standards immediately.
    if (user.usage.planExpiry && user.usage.planExpiry < now) {
        user.usage.planExpiry = null; // Remove Pro Status
        user.usage.limit = FREE_LIMIT; // Wipe old credits, give 10 free
        user.usage.lastReset = now;    // Mark today as reset day
        isModified = true;
    }

    // --- LOGIC 2: THE DAILY TOP-UP ---
    // Only runs if they are Free (expiry is null) AND have low balance.
    // Note: If Logic 1 ran, this logic is skipped effectively because limit is already 10.
    else if (!user.usage.planExpiry && user.usage.limit < FREE_LIMIT) {
        
        const lastResetDate = new Date(user.usage.lastReset).setHours(0,0,0,0);

        // Is it a New Day?
        if (lastResetDate < todayStart) {
            user.usage.limit = FREE_LIMIT; // Refill to 10
            user.usage.lastReset = now;
            isModified = true;
        }
    }

    // --- SAVE ---
    if (isModified) {
        user = await user.save();
    }

    // --- RETURN ---
    callback(null, { 
        allowed: user.usage.limit > 0, 
        remaining: user.usage.limit 
    });
}

module.exports = {
    getProfile,
    updateProfile,
    deleteAccount
}