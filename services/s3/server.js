// gateway/server.js
require('dotenv').config({path: require.resolve("./src/config/.env")});
const http = require('http');

const { app, logger } = require('./src/app/app');
const { closeAllClients } = require('./src/utils/require');

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);

server.listen(PORT, () => {
  logger.info(`🚀 API Gateway running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});

// --- Graceful Shutdown Logic ---
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} signal received: initiating shutdown...`);
  
  // 1. Close gRPC connections immediately (Do not wait for HTTP to drain)
  try {
    closeAllClients();
    logger.info('All gRPC clients closed successfully');
  } catch (err) {
    logger.error('Error closing gRPC clients:', err);
  }

  // 2. Ask HTTP server to close
  server.close(() => {
    logger.info('HTTP server closed cleanly');
    process.exit(0); // Clean exit!
  });
  
  if (server.closeAllConnections) {
    server.closeAllConnections();
  }

  // 4. Safety net
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);
};

// Listen for termination signals (e.g., Ctrl+C or Kubernetes termination)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions (bugs in code)
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1); // Exit is mandatory on uncaught exception to restart in a clean state
});

// Handle unhandled promise rejections (async bugs)
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optional: process.exit(1); 
});