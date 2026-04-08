require("module-alias/register")

const {User, logger, Subscription} = require("@utils/require")
const {CatchAsync, AppError, converge} = require("@shared/utils/handler")

const getProfile = CatchAsync(async(call,callback) => {
    const { userId } = call.request;
    const user = await User.findById(userId)
                .select("name email profilePicture proTokens freeTokens lastDailyReset")
    const subscription = await Subscription.findOne({ userId, active: true })
                .select("plan endDate createdAt").lean();    

    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND)
    const userData = converge({user, subscription})
    callback(null, { userData });
})

const updateProfile = CatchAsync(async(call,callback) => {
    const { userId, name, email } = call.request;
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found", grpc.status.NOT_FOUND)

    user.name = name || user.name;
    user.email = email || user.email;
    await user.save();
    const userData = converge({user})
    callback(null, { userData });
})

const deleteAccount = CatchAsync(async(call,callback) => {
    const { userId } = call.request;
    await User.findByIdAndDelete(userId);
        
    callback(null, { message: "User deleted successfully" });
})


module.exports = {
    getProfile,
    updateProfile,
    deleteAccount
}