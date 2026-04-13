require("module-alias/register")
require('dotenv').config({});

const grpc = require("@grpc/grpc-js")
const loader = require("@grpc/proto-loader")
console.log(process.env.S1_SERVER_URL, process.env.S2_SERVER_URL)
const s1Auth = require("@shared/utils/grpc").clientInit(grpc, loader, require.resolve("@shared/proto/s1.proto"), "user.AuthService", null, process.env.S1_SERVER_URL || "localhost:50052");
const s1User = require("@shared/utils/grpc").clientInit(grpc, loader, require.resolve("@shared/proto/s1.proto"), "user.UserService", null, process.env.S1_SERVER_URL || "localhost:50052");
const s1Subscription = require("@shared/utils/grpc").clientInit(grpc, loader, require.resolve("@shared/proto/s1.proto"), "user.SubscriptionService", null, process.env.S1_SERVER_URL || "localhost:50052");
const s2Client = require("@shared/utils/grpc").clientInit(grpc, loader, require.resolve("@shared/proto/s2.proto"), "ocr.OcrService", null, process.env.S2_SERVER_URL || "localhost:50053");

// Function to close all gRPC clients
function closeAllClients() {
        const clients = [s1Auth, s1User, s1Subscription, s2Client];

        clients.forEach(client => {
            if (client && typeof client.close === 'function')client.close();
        })
}

module.exports = {
    // GRPC CLIENTS
    s1Auth,
    s1User,
    s1Subscription,
    s2Client,
    closeAllClients,
    // PINO logger
    logger: require("@shared/utils/handler").pinoInstance(require("pino"),require.resolve("@root"))
}