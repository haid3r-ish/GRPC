require('dotenv').config({path: require.resolve("./src/config/.env")});
require("module-alias/register")
const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const mongoose = require("mongoose")

const color = require("@shared/utils/color");
const {authService, userService, subscriptionService} = require("@utils/serviceObj");


(async()=>{
  try{
    await require("@shared/utils/handler").DBconnection(mongoose,color)
    // grpc Server
    const {trytoShut, forceShut} = await require("@shared/utils/grpc")
                                      .serverInit(grpc,loader,require.resolve("@shared/proto/s1.proto"),null, [
                                          {path: "user.AuthService", impl: authService},
                                          {path: "user.UserService", impl: userService},
                                          {path: "user.SubscriptionService", impl: subscriptionService}
                                      ], null, "0.0.0.0:50052")
    } catch(err) {
      console.log(err)
    }

})()