const cleanStack = require("clean-stack")

const color = require("@shared/utils/color")

//// ERROR HANDLING ////
class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode
        this.isOperational = true;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
    }
}

//// CLEAN_STACK ////
function cleanErrStack(stack){
    if(!stack) return error

    stack = cleanStack(stack, {
        pretty: true
    })

    return stack
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

//// GRPC ASYNC WRAPPER ////
function CatchAsync(fn){
    return async (call, callback) => {
        try {
            await fn(call, callback);
        } catch (err) {
            const serviceError = {
                "code": err.statusCode || 500,
                "details": err.message || "Internal Server Error",
            }
            // err.stack = cleanErrStack(err.stack)
            console.log(err)
            callback(serviceError, null);
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

/// OBJECT INTO STRING , GRPC ///
function converge(data) {
    if (data === undefined || data === null) return "";
    return JSON.stringify(data);
};

/// STRING INTO OBJECT , GRPC ///
function diverge(dataString) {
    if (!dataString) return null; 
    try {
        return JSON.parse(dataString);
    } catch (err) {{}
        console.error("gRPC Parse Error:", err);
        return null; 
    }
};

function verifyNullish (...fields){
    return fields.some((val) => val == null)
}

module.exports = {
    pinoInstance,
    AppError,
    GER,
    CatchAsync,
    DBconnection,
    converge,
    diverge,
    verifyNullish
}