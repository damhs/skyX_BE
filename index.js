const dotenv = require("dotenv");
const { initRedis } = require("./src/redis.js");
const { initHttpServer } = require("./src/httpServer.js");
const { initWebSocketServer } = require("./src/wsServer.js");

dotenv.config(); // 환경 변수 설정

// Redis 초기화
initRedis().then(() => {
  console.log("Redis initialized");

  // HTTP 서버 초기화
  const server = initHttpServer();

  // WebSocket 서버 초기화
  initWebSocketServer(server);

}).catch((err) => {
  console.error("Error initializing Redis:", err);
});
