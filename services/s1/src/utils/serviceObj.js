const authController = require("@controller/auth")
const VerifyUser = require("@middleware/Pre/VerifyUser")
const userController = require("@controller/user")
const subscriptionController = require("@controller/subscription")

// this is used to fetch all grpc functions in one place
module.exports = {
    authService: {...authController, ...VerifyUser},
    userService: {...userController},
    subscriptionService: {...subscriptionController}
}