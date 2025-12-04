const color = require("@shared/utils/color")

async function serverInit(grpc, protoLoader, protoPath, servicePath, serviceObj, credObj, port){
    let proto = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath))
    // load service class in nested objects using reduce
    let service = servicePath.split('.').reduce((obj,key)=> obj[key],proto)
    // server and add services
    const server = new grpc.Server();
    server.addService(service.service,serviceObj);
    // create creds
    var cred = null
    if(!credObj){
        cred = grpc.ServerCredentials.createInsecure()
    } else{
        cred = credObj
    }

    server.bindAsync(port, cred, (err, port)=> {
        if(err){
            throw new Error(err)
        } else{
            console.log("server running on port ",port)
            server.start()
            return {
                trytoShut: () => server.tryShutdown((err) => color.info(err ? "Error in Shutting gRPC" : "gRPC Shut Gracefully")),
                forceShut: () => server.forceShutdown()
            }
        }
    })
}

function clientInit(grpc, protoLoader, protoPath, servicePath, credObj, port){
    const proto = grpc.loadPackageDefinition(protoLoader.loadSync(protoPath))

    const service = servicePath.split('.').reduce((obj,key)=> obj[key],proto)
    if(!service || service.length == 0){

    }

    let cred = null
    if(!credObj){
        cred = grpc.credentials.createInsecure()
    } else{

    }
    const client = new service(String(port), cred)
    if(!client){
        throw new Error()
    }
    return client
}

// Wrapper of Function, for running function(middleware) in sequence
function wrapper(fn, ...wrappers) {
  return wrappers.reverse().reduce((acc, wrapper) => wrapper(acc), fn);
}


module.exports = {
    serverInit,
    clientInit,
    wrapper
}