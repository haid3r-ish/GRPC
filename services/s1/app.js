require("module-alias/register")
require("dotenv").config({path: require.resolve("@root/src/config/.env")})

const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const mongoose = require("mongoose")

// const services = require("@utils/serviceObj");
const color = require("@shared/utils/color");
const services = require("@utils/serviceObj");

(async()=>{
  try{
    await require("@shared/utils/EventHandle").DBconnection(mongoose,color)
    // grpc Server
    const {trytoShut, forceShut} = await require("@shared/utils/grpc")
                          .serverInit(grpc,loader,require.resolve("@shared/proto/s1.proto"),"user.AuthService", services, null, "0.0.0.0:50052")
  } catch(err) {
    console.log(err)
  }

})()