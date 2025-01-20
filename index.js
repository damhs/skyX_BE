// index.js
const { initRedis } = require("./src/redis.js");
const { initHttpServer } = require("./src/httpServer.js");
const { initWebSocketServer } = require("./src/wsServer.js");

async function startServer() {
  try {
    await initRedis();
    console.log("Redis initialized");

    const server = initHttpServer();
    initWebSocketServer(server);

    console.log("Server started successfully");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();