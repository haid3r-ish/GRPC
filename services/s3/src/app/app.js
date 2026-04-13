require("module-alias/register")

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
// const rateLimit = require('express-rate-limit');
const pino = require('pino');
const pinoHttp = require('pino-http');
const cookieParser = require("cookie-parser")
const morgan = require('morgan');
const passport = require('passport');
const session = require('express-session');

const {logger} = require("@util/require");
const {authRouter, userRouter, subscriptionWebHook} = require("@route/s1Route")
const fileRouter = require("@route/s2Route")

// Initialize Passport Strategy
require("@config/passport");

const app = express();

//HELMET
app.use(morgan('short'))
app.use(helmet());
app.set('trust proxy', 1);
//CORS Configuration
const corsOptions = {
  origin: true,
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
};
app.use(cors(corsOptions));
//Rate Limiting
// app.use(rateLimit({
//   windowMs: 15 * 60 * 1000, 
//   max: 100, 
//   message: 'Too many requests from this IP, please try again later.',
//   standardHeaders: true, 
//   legacyHeaders: false,
// }))
//HTTP Request Logging
// app.use(pinoHttp({ 
//   logger,
//   serializers: {
//     req: (req) => ({
//       method: req.method,
//       url: req.url,
//       // Remove Auth tokens
//       headers: { ...req.headers, authorization: '[REDACTED]' } 
//     })
//   }
// }));

// Session Configuration for Passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Initialize Passport
app.use(passport.initialize());
app.use(passport.session());

// WEBSOCKET SETUP
app.post('/api/auth/subscription-webhook', express.raw({type: 'application/json'}),subscriptionWebHook);
//Body Parsing
app.use(express.json({ limit: '10kb' }));
// Cookie Parser
app.use(cookieParser())

// ROUTES
app.use("/api/auth", authRouter)
app.use("/api/user", userRouter)
app.use("/api/file", fileRouter)
app.all("*splash", async (req,res) => {
  res.status(400).send("Routes is not defined")
})


// Centralized Error Handling
app.use((err, req, res, next) => {
  const log = req.log || logger;
    console.log("GER: ",err)
  // log.error({ 
  //   err: {
  //     message: err.message,
  //     stack: err.stack,
  //     code: err.code
  //   }
  // }, 'Request failed');
  
  res.status(err.status || 500).json({
    error: {
      message: err.message || 'Internal Server Error',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
});

module.exports = { app, logger };