const { initRedis } = require("./src/redis.js");
const { initHttpServer } = require("./src/httpServer.js");
const { initWebSocketServer } = require("./src/wsServer.js");
// const { initBuildingObstacles } = require("./src/Service/buildingService.js");

async function startServer() {
  try {
    // 1) Redis init
    await initRedis();
    console.log("Redis initialized");

    // // 2) Building Obstacles init (MySQL → 메모리)
    // await initBuildingObstacles();
    // console.log("Building obstacles initialized");

    // 3) HTTP & WebSocket Server init
    const server = initHttpServer();
    initWebSocketServer(server);

    console.log("Server started successfully");
  } catch (error) {
    console.error("Error starting server:", error);
    process.exit(1);
  }
}

startServer();