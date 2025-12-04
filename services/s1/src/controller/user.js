
const {User, logger, AppError, CatchAsync} = require("@utils/require")

const getProfile = CatchAsync(async(call,callback) => {
    const { userId } = call.request;
    const user = await User.findById(userId).select("name email");
    if (!user) throw new AppError("User not found")
    
    callback(null, { userId: user._id.toString(), name: user.name, email: user.email });
})

const updateProfile = CatchAsync(async(call,callback) => {
    const { userId, name, email } = call.request;
    const user = await User.findById(userId);
    if (!user) throw new AppError("User not found")

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


module.exports = {
    getProfile,
    updateProfile,
    deleteAccount
}