const cleanStack = require("clean-stack")

const color = require("@shared/utils/color")

//// ERROR HANDLING ////
class AppError extends Error{
    constructor(message){
        super(message)
        this.message = message
        this.isOperational = true;
        // Set the error name to the class name
        this.name = this.constructor.name;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

//// CLEAN_STACK ////
function cleanErrStack(error){
    if(!error.stack) return error

    error.stack = cleanStack(error.stack, {
        pretty: true
    })

    return error
}


function GER(err){
    // if(process.env.NODE_ENV === "dev"){
    //     // Make the stack readable and return the error object
    //     color.err(cleanErrStack(err))
    // }
    return {
        message: err.message || 'Internal Server Error',
    };
}

//// ASYNC WRAPPER ////
function CatchAsync(fn){
    return async (call, callback) => {
        try {
            await fn(call, callback);
        } catch (err) {
            const grpcError = GER(err);
            console.log(err)
            callback(grpcError, null);
        }
    };
}


//// LOGGER ////
function pinoInstance(pino, dstPath){
    const logger = pino({
        base: null,
    },pino.transport({
        targets: [
            // {
            //     target: "pino/file",
            //     options: {destination: dstPath, mkdir: true}
            // },
            {
                target: "pino-pretty",
                options: {
                    destination: 1,
                    colorize: true,
                    customColors: 'info:green,err:white,warn:white,fatal:white,debug:white',
                    
                    translateTime: "SYS:standard",
                    ignore: "pid,hostname"
                }
            }
        ]
    }))

    return logger
}

//// DATABASE CONNECTION ////
async function DBconnection({connect, connection}){
    await connect("mongodb://localhost:27017/fyp")
        .then(()=> color.success("Database connected Successfully!"))
        .catch((err) => color.err(err))
}


module.exports = {
    pinoInstance,
    AppError,
    GER,
    CatchAsync,
    DBconnection,
}