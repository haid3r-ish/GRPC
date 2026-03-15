const color = require("@shared/utils/color")

// async function serverInit(grpc, protoLoader, protoPath, servicePath, serviceObj, credObj, port){
//     let proto = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath))
//     // load service class in nested objects using reduce
//     let service = servicePath.split('.').reduce((obj,key)=> obj[key],proto)
//     // server and add services
//     const server = new grpc.Server();
//     if(Array.isArray(serviceObj)) {
//         serviceObj.forEach((obj) => server.addService(service.service, obj))
//     } else {
//         server.addService(service.service,serviceObj);
//     }
//     // create creds
//     var cred = null
//     if(!credObj){
//         cred = grpc.ServerCredentials.createInsecure()
//     } else{
//         cred = credObj
//     }

//     server.bindAsync(port, cred, (err, port)=> {
//         if(err){
//             throw new Error(err)
//         } else{
//             console.log("server running on port ",port)
//             server.start()
//             return {
//                 trytoShut: () => server.tryShutdown((err) => color.info(err ? "Error in Shutting gRPC" : "gRPC Shut Gracefully")),
//                 forceShut: () => server.forceShutdown()
//             }
//         }
//     })
// }

async function serverInit(grpc, protoLoader, protoPath, servicePath, serviceObj, credObj, port) {
    const proto = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath));
    const server = new grpc.Server();

    // 1. Normalize input: If array, use it; if single, wrap it in array with the path argument
    const services = Array.isArray(serviceObj) 
        ? serviceObj 
        : [{ path: servicePath, impl: serviceObj }];

    // 2. Loop and Register
    services.forEach(item => {
        const serviceDef = item.path.split('.').reduce((obj, key) => obj[key], proto);
        server.addService(serviceDef.service, item.impl);
    });

    const cred = credObj || grpc.ServerCredentials.createInsecure();

    server.bindAsync(port, cred, (err, port) => {
        if (err) throw new Error(err);
        console.log("Server running on port", port);
        server.start();
    });

    return {
        trytoShut: () => server.tryShutdown((err) => console.log(err ? "Error" : "Shut Gracefully")),
        forceShut: () => server.forceShutdown()
    };
}

function clientInit(grpc, protoLoader, protoPath, servicePath, credObj, port){
    const proto = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath))
    const cred = credObj || grpc.credentials.createInsecure();

    const createClient = (path) => {
        const ServiceConstructor = path.split('.').reduce((obj, key) => obj && obj[key], proto);
        if (!ServiceConstructor) {
            throw new Error(`gRPC Client Init Failed: Path '${path}' not found in proto`);
        }
        return new ServiceConstructor(String(port), cred);
    };

    // 1. If user passed a SINGLE string, return the SINGLE client directly
    if (!Array.isArray(servicePath)) {
        return createClient(servicePath);
    }

    // 2. If user passed an ARRAY, return an Object containing all clients
    const clients = {};
    servicePath.forEach(path => {
        const clientName = path.split('.').pop();servicePath
        clients[clientName] = createClient(path);
    });

    return clients;
}

module.exports = {
    serverInit,
    clientInit
}