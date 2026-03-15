require('dotenv').config({path: require.resolve("./src/config/.env")});
require("module-alias/register")
const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const mongoose = require("mongoose")

const color = require("@shared/utils/color");
const serviceObj = require("@utils/serviceObj");



(async()=>{
  try{
    await require("@shared/utils/handler").DBconnection(mongoose,color)
    // grpc Server
    const {trytoShut, forceShut} = await require("@shared/utils/grpc")
                                      .serverInit(grpc,loader,require.resolve("@shared/proto/s2.proto"),"ocr.OcrService", serviceObj, null, "0.0.0.0:50053")
    } catch (err) {
      console.error("Startup error:", err);
      if (err && err.stack) console.error(err.stack);
    }

})()