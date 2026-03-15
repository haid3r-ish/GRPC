require("module-alias/register")
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const {diverge} = require("@shared/utils/handler")

// 1. Load Proto
const packageDefinition = protoLoader.loadSync(require.resolve("@shared/proto/s1.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const packageDefinition2 = protoLoader.loadSync(require.resolve("@shared/proto/s2.proto"), {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const userProto = grpc.loadPackageDefinition(packageDefinition).user;
const ocrProto = grpc.loadPackageDefinition(packageDefinition2).ocr;
// 2. Create Clients
const authClient = new userProto.AuthService(
  "localhost:50052",
  grpc.credentials.createInsecure()
);
const userClient = new userProto.UserService(
  "localhost:50052",
  grpc.credentials.createInsecure()
);
const subscriptionClient = new userProto.SubscriptionService( 
  "localhost:50052",
  grpc.credentials.createInsecure()
);
const ocr = new ocrProto.OcrService(
  "localhost:50053",
  grpc.credentials.createInsecure()
);

// Helper to Promisify gRPC calls
const runRpc = (client, method, payload) => {
  return new Promise((resolve, reject) => {
    client[method](payload, (err, response) => {
      if (err) return reject(err);
      resolve(response);
    });
  });
};

// --- TEST DATA ---
const TEST_USER = {
  // email: `test_17634@example.com`,
  // password: "password123",
  // name: "TEST USER",
  userId: "699d19910310f8859a8daa08",
  cost: 4
};

(async () => {
  try {
    console.log("\n--- 1. Testing SIGNUP ---");
    const test = await runRpc(ocr, "AnalyzeSubscription", TEST_USER);
    console.log("✅ Test RPC Success:", test);
    process.exit(0)
    // const signupRes = await runRpc(authClient, "Signup", TEST_USER);
    // signupRes.userData = diverge(signupRes.userData)
    // console.log("✅ Signup Success:", signupRes);
    // process.exit(0)
    // const userId = "69764aa291bd7555139fcfdc";
    // let sessionCookie = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyRGF0YSI6eyJpZCI6IjY5NzVkMTY5MGZlM2VhMjg3YzI0NzIwNCIsImVtYWlsIjoidGVzdF8xNzY5MzI5MDAxNzg0QGV4YW1wbGUuY29tIiwibmFtZSI6IlVwZGF0ZWQgTmFtZSJ9LCJzZXNzaW9uVGltZSI6MTc2OTM1NjcyNjg5NSwic2Vzc2lvblRva2VuIjoiNjYxZDJiZmJhNTQ1NTkwZmY2NDgiLCJpYXQiOjE3NjkzNTY3MjYsImV4cCI6MTc3NzEzMjcyNn0.KVwqS5JdxGjzUG1FO6bC8osWbAiTmKvkN5ix0nwGcXE';
    // console.log("\n--- 2. Testing VERIFY USER (with Cookie) ---");
    // const verifyRes = await runRpc(authClient, "verifyUser", { sessionCookie });
    // console.log("✅ Verificatio0n Success. User:", verifyRes.userData.name);
    
    // console.log("\n--- 3. Testing LOGOUT ---");
    // // Note: Code logout requires userId, but verifies logic via cookie usually.
    // await runRpc(authClient, "Logout", { userId });
    // console.log("✅ Logout called successfully");
    
    // console.log("\n--- 4. Testing LOGIN ---");
    // const loginRes = await runRpc(authClient, "Login", {
    //   email: TEST_USER.email,
    //   password: TEST_USER.password,
    // });
    // console.log("✅ Login Success:", loginRes.userData.email);
    // sessionCookie = loginRes.sessionCookie; // Update cookie
    
    // console.log("\n--- 5. Testing GET PROFILE ---");
    // const profileRes = await runRpc(userClient, "GetProfile", { userId });
    // console.log("✅ Profile Fetched:", profileRes);
    
    // console.log("\n--- 6. Testing UPDATE PROFILE ---");
    // const updateRes = await runRpc(userClient, "UpdateProfile", {
    //   userId,
    //   name: "Updated Name",
    //   email: TEST_USER.email,
    // });
    // console.log("✅ Profile Updated:", updateRes.name);
    
    // console.log("\n--- 7. Testing CHANGE PASSWORD ---");
    // await runRpc(authClient, "ChangePassword", {
    //   userId,
    //   oldPassword: TEST_USER.password,
    //   newPassword: "newpassword456",
    // });
    // console.log("✅ Password Changed");
    
    // console.log("\n--- 8. Testing REQUEST PASSWORD RESET ---");
    // const resetReqRes = await runRpc(authClient, "RequestPasswordReset", {
    //   email: TEST_USER.email,
    // });
    // console.log("✅ Reset Token Received:", resetReqRes.resetToken);
    
    // console.log("\n--- 9. Testing RESET PASSWORD ---");
    // const resetRes = await runRpc(authClient, "ResetPassword", {
    //   resetToken: "760c3be30ddb19651de76bceaa7fcb070a4fe0df",
    //   newPassword: "finalpassword789",
    //   email: TEST_USER.email,
    // });
    // console.log("✅ Password Reset Complete. New Token:", resetRes.token);
    
    console.log("\n--- 10. Testing DELETE ACCOUNT ---");
    const deleteRes = await runRpc(userClient, "DeleteAccount", { userId });
    console.log("✅ Account Deleted:", deleteRes.message);
    process.exit(0)
    
    console.log("\n🎉 ALL TESTS PASSED!");
  } catch (error) {
    console.error("❌ TEST FAILED:", error.details || error.message);
  }
})();







// const grpc = require("@grpc/grpc-js");
// const protoLoader = require("@grpc/proto-loader");
// const path = require("path");
// const fs = require("fs")

// // --- 1. Load Proto (Ensuring the proto file exists) ---
// const base = process.cwd();
// const protoFilePath = path.join(base, 'fusion.proto');

// // Write the proto file content
// fs.writeFileSync(protoFilePath,`
// syntax = "proto3";

// package fusion;

// // 1. Authentication Service
// service AuthService {
//   rpc Verify (AuthRequest) returns (AuthResponse);
// }
// message AuthRequest { string userId = 1; string token = 2; }
// message AuthResponse { bool ok = 1; string userId = 2; string msg = 3; }

// // 2. Billing Service
// service BillingService {
//   rpc Check (BillingRequest) returns (BillingResponse);
// }
// message BillingRequest { string userId = 1; }
// message BillingResponse { bool ok = 1; string plan = 2; string msg = 3; }

// // 3. Profile Service
// service ProfileService {
//   rpc Load (ProfileRequest) returns (ProfileResponse);
// }
// message ProfileRequest { string userId = 1; }
// message ProfileResponse { bool ok = 1; string status = 2; string msg = 3; }

// // 4. Final Gateway Service (The user-facing API)
// service FinalService {
//   rpc GetUser (FinalRequest) returns (FinalResponse);
// }
// message FinalRequest { string userId = 1; string token = 2; }
// // Note: FinalResponse gathers data from all services
// message FinalResponse { bool ok = 1; string userId = 2; string plan = 3; string status = 4; string msg = 5; }
// `.trim());

// const packageDef = protoLoader.loadSync(protoFilePath, { keepCase: true, defaults: true });
// const proto = grpc.loadPackageDefinition(packageDef);

// const { AuthService, BillingService, ProfileService, FinalService } = proto.fusion;

// // --- 2. Safe callClient Utility ---
// /**
//  * Wraps a gRPC client call in a Promise with timeout logic.
//  */
// function callClient(client, methodName, req, timeoutMs = 3000) {
//   return new Promise((resolve, reject) => {
//     let called = false;
//     const timer = setTimeout(() => {
//       if (!called) {
//         called = true;
//         reject(new Error(`${methodName} RPC timeout`));
//       }
//     }, timeoutMs);

//     try {
//       client[methodName](req, (err, res) => {
//         if (called) return;
//         called = true;
//         clearTimeout(timer);
//         if (err) return reject(err);
//         resolve(res);
//       });
//     } catch (e) {
//       if (!called) {
//         called = true;
//         clearTimeout(timer);
//         reject(e);
//       }
//     }
//   });
// }

// // --- 3. Function Fusion Utility ---
// /**
//  * Chains asynchronous middleware steps together.
//  * Each step receives the result of the previous step (ctx) and returns a new ctx.
//  */
// function fuse(...steps) {
//   return async function (ctx) {
//     let result = ctx;
//     for (const step of steps) {
//       result = await step(result);
//     }
//     return result;
//   };
// }

// // --- 4. Start Downstream Services (Simulations) ---

// function startAuthService() {
//   const server = new grpc.Server();
//   server.addService(AuthService.service, {
//     Verify: (call, callback) => {
//       console.log(`[AUTH:50051] Request received for userId: ${call.request.userId}`);
//       const { token, userId } = call.request;
//       if (token === "valid-token") return callback(null, { ok: true, userId });
//       callback(null, { ok: false, msg: "Invalid token" });
//     },
//   });
//   return new Promise((res, rej) => {
//     server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure(), (err) => {
//       if (err) return rej(err);
//       server.start();
//       console.log("▶ AuthService running at 50051");
//       res(server);
//     });
//   });
// }

// function startBillingService() {
//   const server = new grpc.Server();
//   server.addService(BillingService.service, {
//     Check: (call, callback) => {
//       console.log(`[BILLING:50052] Request received for userId: ${call.request.userId}`);
//       const { userId } = call.request;
//       if (userId === "user-1") return callback(null, { ok: true, plan: "PRO" });
//       callback(null, { ok: false, msg: "No active plan" });
//     },
//   });
//   return new Promise((res, rej) => {
//     server.bindAsync("0.0.0.0:50052", grpc.ServerCredentials.createInsecure(), (err) => {
//       if (err) return rej(err);
//       server.start();
//       console.log("▶ BillingService running at 50052");
//       res(server);
//     });
//   });
// }

// function startProfileService() {
//   const server = new grpc.Server();
//   server.addService(ProfileService.service, {
//     Load: (call, callback) => {
//       console.log(`[PROFILE:50053] Request received for userId: ${call.request.userId}`);
//       const { userId } = call.request;
//       if (userId === "user-1") return callback(null, { ok: true, status: "ACTIVE" });
//       callback(null, { ok: false, msg: "Profile not found" });
//     },
//   });
//   return new Promise((res, rej) => {
//     server.bindAsync("0.0.0.0:50053", grpc.ServerCredentials.createInsecure(), (err) => {
//       if (err) return rej(err);
//       server.start();
//       console.log("▶ ProfileService running at 50053");
//       res(server);
//     });
//   });
// }

// // --- 5. Downstream Client Initialization ---
// const authClient = new AuthService("localhost:50051", grpc.credentials.createInsecure());
// const billingClient = new BillingService("localhost:50052", grpc.credentials.createInsecure());
// const profileClient = new ProfileService("localhost:50053", grpc.credentials.createInsecure());

// // --- 6. Middleware Functions ---

// async function authMiddleware(ctx){
//   const res = await callClient(authClient, "Verify", { userId: ctx.userId, token: ctx.token });
//   if (!res.ok) throw new Error(res.msg || "Auth failed");
//   // Update ctx with verified user ID (or the original, if not returned)
//   ctx.userId = res.userId; 
//   return ctx;
// }

// function billingMiddleware() {
//   return async function (ctx) {
//     const res = await callClient(billingClient, "Check", { userId: ctx.userId });
//     if (!res.ok) throw new Error(res.msg || "Billing check failed");
//     ctx.plan = res.plan;
//     return ctx;
//   };
// }

// function profileMiddleware() {
//   return async function (ctx) {
//     const res = await callClient(profileClient, "Load", { userId: ctx.userId });
//     if (!res.ok) throw new Error(res.msg || "Profile load failed");
//     ctx.status = res.status;
//     return ctx;
//   };
// }

// function finalHandler() {
//   return async function (ctx) {
//     // This is the final aggregation point before sending the response
//     console.log("finalctx:", ctx);
//     return { 
//       ok: true, 
//       userId: ctx.userId, 
//       plan: ctx.plan, 
//       status: ctx.status,
//       msg: "User data successfully aggregated."
//     };
//   };
// }

// // --- 7. Start Final Gateway Service ---

// function startFinalService() {
//   const server = new grpc.Server();

//   const pipeline = fuse(
//     authMiddleware,
//     billingMiddleware(),
//     profileMiddleware(),
//     finalHandler()
//   );

//   server.addService(FinalService.service, {
//     GetUser: async (call, callback) => {
//       try {
//         // Initial context from the incoming request
//         const ctx = { userId: call.request.userId, token: call.request.token };
        
//         // Execute the entire microservice pipeline
//         const res = await pipeline(ctx);
        
//         // Send the final successful response back to the client
//         callback(null, res);
//       } catch (err) {
//         // Handle any errors thrown by the middleware chain
//         console.error("Pipeline Error:", err.message);
        
//         // Return a gRPC error status and the user-friendly message
//         callback({ 
//           code: grpc.status.UNAUTHENTICATED, // Using a specific gRPC status
//           message: err.message 
//         });
//       }
//     },
//   });

//   return new Promise((res, rej) => {
//     server.bindAsync("0.0.0.0:50054", grpc.ServerCredentials.createInsecure(), (err) => {
//       if (err) return rej(err);
//       server.start();
//       console.log("▶ FinalService (Gateway) running at 50054");
//       res(server);
//     });
//   });
// }

// // --- 8. Client Test Logic ---

// const finalClient = new FinalService("localhost:50054", grpc.credentials.createInsecure());

// async function runTest(testName, request) {
//   console.log(`\n--- Running Test: ${testName} ---`);
//   try {
//     const result = await callClient(finalClient, "GetUser", request);
//     console.log("done")
//     console.log(`✅ SUCCESS:`);
//     console.log(result);
//   } catch (error) {
//     console.log(`❌ FAILURE:`);
//     // gRPC errors often have a .details property for the message
//     console.log(`Error: ${error.details || error.message}`); 
//   }
// }


// // --- 9. Bootstrap and Run ---

// async function main() {
//   // Start all downstream services
//   await startAuthService();
//   await startBillingService();
//   await startProfileService();

//   // Start the Gateway service
//   await startFinalService();

//   // Run Client Tests

//   // Test 1: Successful request (Should proceed through all three services)
//   await runTest("Valid User Authentication & Aggregation", { 
//     userId: "user-1", 
//     token: "valid-token" 
//   });

//   // Test 2: Failed request (Should fail at the AuthService step)
//   await runTest("Invalid Token Failure", { 
//     userId: "user-999", 
//     token: "invalid-token" 
//   });
  
//   // Test 3: Valid Token, but downstream service failure (Should fail at BillingService)
//   await runTest("Downstream Billing Failure", { 
//     userId: "user-x", // BillingService will fail for any user other than 'user-1'
//     token: "valid-token" 
//   });
// }

// // Execute the bootstrap function
// main().catch(err => {
//   console.error("\nApplication startup failed:", err);
//   process.exit(1);
// });


// // require("module-alias/register")

// // const {clientInit} = require("@shared/utils/grpc"); 

// // const client = clientInit(grpc, protoLoader, require.resolve("@shared/proto/s1.proto"), ["user.AuthService", "user.UserService"], null, "0.0.0.0:50052");

// // client.AuthService.signup({ email: "new2", name: "ali", password: "123" }, (err, res) => {
// //     if (err) console.log(err);
// //     else console.log(res);
// // });
// // client.AuthService.login({ email: "new2",  password: "123" }, (err, res) => {
// //     if (err) console.log(err);
// //     console.log(res);
// // });
