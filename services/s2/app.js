const grpc = require("@grpc/grpc-js");
const loader = require("@grpc/proto-loader");
const name = "server2";

const proto2 = grpc.loadPackageDefinition(loader.loadSync("./../proto/s2.proto"));
const { s2Service } = proto2.service.s2.v1;

const proto1 = grpc.loadPackageDefinition(loader.loadSync("./../proto/s1.proto"));
const { s1Service } = proto1.service.s1.v1;

const s1Client = new s1Service("0.0.0.0:50051", grpc.credentials.createInsecure());

function chat(call) {
  call.on("data", (msg) => {
    console.log(`[S2] received:`, msg.message);
    call.write({
      message: `[Echo from ${name}] ${msg.message}`,
      createdAt: { seconds: Date.now() / 1000 },
      id: { Sid: name },
    });
  });

  call.on("end", () => {
    call.end();
  });
}

function serverStart() {
  const server = new grpc.Server();
  server.addService(s2Service.service, { chat });

  server.bindAsync("0.0.0.0:50052", grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) return console.error(err);
    console.log(`[S2] running on port ${port}`);
    server.start();
    starter();
  });
}

function starter() {
  const stream = s1Client.chat();
  process.stdin.on("data", (data) => {
    stream.write({
      message: data.toString().trim(),
      createdAt: { seconds: Date.now() / 1000 },
      id: { Sid: name },
    });
  });

  stream.on("data", (msg) => {
    console.log(`[S2] response from S1:`, msg.receivedBy, msg.status);
  });
}

serverStart();
