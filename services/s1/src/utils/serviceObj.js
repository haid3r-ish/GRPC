const authController = require("@controller/auth")
const VerifyUser = require("@middleware/Pre/VerifyUser")
const userController = require("@controller/user")

// this is used to fetch all grpc functions in one place
module.exports = {
    ...authController,
    ...VerifyUser,
    ...userController
}