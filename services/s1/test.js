const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");
const fs = require("fs")

// --- 1. Load Proto (Ensuring the proto file exists) ---
const base = process.cwd();
const protoFilePath = path.join(base, 'fusion.proto');

// Write the proto file content
fs.writeFileSync(protoFilePath,`
syntax = "proto3";

package fusion;

// 1. Authentication Service
service AuthService {
  rpc Verify (AuthRequest) returns (AuthResponse);
}
message AuthRequest { string userId = 1; string token = 2; }
message AuthResponse { bool ok = 1; string userId = 2; string msg = 3; }

// 2. Billing Service
service BillingService {
  rpc Check (BillingRequest) returns (BillingResponse);
}
message BillingRequest { string userId = 1; }
message BillingResponse { bool ok = 1; string plan = 2; string msg = 3; }

// 3. Profile Service
service ProfileService {
  rpc Load (ProfileRequest) returns (ProfileResponse);
}
message ProfileRequest { string userId = 1; }
message ProfileResponse { bool ok = 1; string status = 2; string msg = 3; }

// 4. Final Gateway Service (The user-facing API)
service FinalService {
  rpc GetUser (FinalRequest) returns (FinalResponse);
}
message FinalRequest { string userId = 1; string token = 2; }
// Note: FinalResponse gathers data from all services
message FinalResponse { bool ok = 1; string userId = 2; string plan = 3; string status = 4; string msg = 5; }
`.trim());

const packageDef = protoLoader.loadSync(protoFilePath, { keepCase: true, defaults: true });
const proto = grpc.loadPackageDefinition(packageDef);

const { AuthService, BillingService, ProfileService, FinalService } = proto.fusion;

// --- 2. Safe callClient Utility ---
/**
 * Wraps a gRPC client call in a Promise with timeout logic.
 */
function callClient(client, methodName, req, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let called = false;
    const timer = setTimeout(() => {
      if (!called) {
        called = true;
        reject(new Error(`${methodName} RPC timeout`));
      }
    }, timeoutMs);

    try {
      client[methodName](req, (err, res) => {
        if (called) return;
        called = true;
        clearTimeout(timer);
        if (err) return reject(err);
        resolve(res);
      });
    } catch (e) {
      if (!called) {
        called = true;
        clearTimeout(timer);
        reject(e);
      }
    }
  });
}

// --- 3. Function Fusion Utility ---
/**
 * Chains asynchronous middleware steps together.
 * Each step receives the result of the previous step (ctx) and returns a new ctx.
 */
function fuse(...steps) {
  return async function (ctx) {
    let result = ctx;
    for (const step of steps) {
      result = await step(result);
    }
    return result;
  };
}

// --- 4. Start Downstream Services (Simulations) ---

function startAuthService() {
  const server = new grpc.Server();
  server.addService(AuthService.service, {
    Verify: (call, callback) => {
      console.log(`[AUTH:50051] Request received for userId: ${call.request.userId}`);
      const { token, userId } = call.request;
      if (token === "valid-token") return callback(null, { ok: true, userId });
      callback(null, { ok: false, msg: "Invalid token" });
    },
  });
  return new Promise((res, rej) => {
    server.bindAsync("0.0.0.0:50051", grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return rej(err);
      server.start();
      console.log("▶ AuthService running at 50051");
      res(server);
    });
  });
}

function startBillingService() {
  const server = new grpc.Server();
  server.addService(BillingService.service, {
    Check: (call, callback) => {
      console.log(`[BILLING:50052] Request received for userId: ${call.request.userId}`);
      const { userId } = call.request;
      if (userId === "user-1") return callback(null, { ok: true, plan: "PRO" });
      callback(null, { ok: false, msg: "No active plan" });
    },
  });
  return new Promise((res, rej) => {
    server.bindAsync("0.0.0.0:50052", grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return rej(err);
      server.start();
      console.log("▶ BillingService running at 50052");
      res(server);
    });
  });
}

function startProfileService() {
  const server = new grpc.Server();
  server.addService(ProfileService.service, {
    Load: (call, callback) => {
      console.log(`[PROFILE:50053] Request received for userId: ${call.request.userId}`);
      const { userId } = call.request;
      if (userId === "user-1") return callback(null, { ok: true, status: "ACTIVE" });
      callback(null, { ok: false, msg: "Profile not found" });
    },
  });
  return new Promise((res, rej) => {
    server.bindAsync("0.0.0.0:50053", grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return rej(err);
      server.start();
      console.log("▶ ProfileService running at 50053");
      res(server);
    });
  });
}

// --- 5. Downstream Client Initialization ---
const authClient = new AuthService("localhost:50051", grpc.credentials.createInsecure());
const billingClient = new BillingService("localhost:50052", grpc.credentials.createInsecure());
const profileClient = new ProfileService("localhost:50053", grpc.credentials.createInsecure());

// --- 6. Middleware Functions ---

async function authMiddleware(ctx){
  const res = await callClient(authClient, "Verify", { userId: ctx.userId, token: ctx.token });
  if (!res.ok) throw new Error(res.msg || "Auth failed");
  // Update ctx with verified user ID (or the original, if not returned)
  ctx.userId = res.userId; 
  return ctx;
}

function billingMiddleware() {
  return async function (ctx) {
    const res = await callClient(billingClient, "Check", { userId: ctx.userId });
    if (!res.ok) throw new Error(res.msg || "Billing check failed");
    ctx.plan = res.plan;
    return ctx;
  };
}

function profileMiddleware() {
  return async function (ctx) {
    const res = await callClient(profileClient, "Load", { userId: ctx.userId });
    if (!res.ok) throw new Error(res.msg || "Profile load failed");
    ctx.status = res.status;
    return ctx;
  };
}

function finalHandler() {
  return async function (ctx) {
    // This is the final aggregation point before sending the response
    console.log("finalctx:", ctx);
    return { 
      ok: true, 
      userId: ctx.userId, 
      plan: ctx.plan, 
      status: ctx.status,
      msg: "User data successfully aggregated."
    };
  };
}

// --- 7. Start Final Gateway Service ---

function startFinalService() {
  const server = new grpc.Server();

  const pipeline = fuse(
    authMiddleware,
    billingMiddleware(),
    profileMiddleware(),
    finalHandler()
  );

  server.addService(FinalService.service, {
    GetUser: async (call, callback) => {
      try {
        // Initial context from the incoming request
        const ctx = { userId: call.request.userId, token: call.request.token };
        
        // Execute the entire microservice pipeline
        const res = await pipeline(ctx);
        
        // Send the final successful response back to the client
        callback(null, res);
      } catch (err) {
        // Handle any errors thrown by the middleware chain
        console.error("Pipeline Error:", err.message);
        
        // Return a gRPC error status and the user-friendly message
        callback({ 
          code: grpc.status.UNAUTHENTICATED, // Using a specific gRPC status
          message: err.message 
        });
      }
    },
  });

  return new Promise((res, rej) => {
    server.bindAsync("0.0.0.0:50054", grpc.ServerCredentials.createInsecure(), (err) => {
      if (err) return rej(err);
      server.start();
      console.log("▶ FinalService (Gateway) running at 50054");
      res(server);
    });
  });
}

// --- 8. Client Test Logic ---

const finalClient = new FinalService("localhost:50054", grpc.credentials.createInsecure());

async function runTest(testName, request) {
  console.log(`\n--- Running Test: ${testName} ---`);
  try {
    const result = await callClient(finalClient, "GetUser", request);
    console.log(`✅ SUCCESS:`);
    console.log(result);
  } catch (error) {
    console.log(`❌ FAILURE:`);
    // gRPC errors often have a .details property for the message
    console.log(`Error: ${error.details || error.message}`); 
  }
}


// --- 9. Bootstrap and Run ---

async function main() {
  // Start all downstream services
  await startAuthService();
  await startBillingService();
  await startProfileService();

  // Start the Gateway service
  await startFinalService();

  // Run Client Tests

  // Test 1: Successful request (Should proceed through all three services)
  await runTest("Valid User Authentication & Aggregation", { 
    userId: "user-1", 
    token: "valid-token" 
  });

  // Test 2: Failed request (Should fail at the AuthService step)
  await runTest("Invalid Token Failure", { 
    userId: "user-999", 
    token: "invalid-token" 
  });
  
  // Test 3: Valid Token, but downstream service failure (Should fail at BillingService)
  await runTest("Downstream Billing Failure", { 
    userId: "user-x", // BillingService will fail for any user other than 'user-1'
    token: "valid-token" 
  });
}

// Execute the bootstrap function
// main().catch(err => {
//   console.error("\nApplication startup failed:", err);
//   process.exit(1);
// });


const loader = protoLoader.loadSync("./src/config/user.proto")
const proto1 = grpc.loadPackageDefinition(loader).user

const client = new proto1.AuthService("localhost:50052",grpc.credentials.createInsecure())

// client.signup({email: "new2", name: "ali", password: "123"},(err,res)=>{
//   if(err) console.log(err)
//   console.log(res)
// })


const obj1 = {
  name: "lai",
  email: "mail"
}
const obj2 = {
  name: "ali",
  email: "mail2"
}

module.exports = {
  ...obj1,
  ...obj2
}