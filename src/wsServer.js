// src/wsServer.js
const WebSocketServer = require("websocket").server;
const { client } = require("./redis.js");
const routeHandler = require("./Handler/routeHandler.js");

// 연결된 클라이언트
const connections = new Map();

/** 특정 유저에게 메시지 전송 */
function sendToUser(user_id, messageObj) {
  const connection = connections.get(user_id);
  if (connection && connection.connected) {
    connection.sendUTF(JSON.stringify(messageObj));
  }
}

/** 전체 브로드캐스트 */
function broadcast(messageObj) {
  for (const [uid, conn] of connections.entries()) {
    if (conn.connected) {
      conn.sendUTF(JSON.stringify(messageObj));
    }
  }
}

// validateUser, parseQueryParams, 등등 기존 로직은 그대로
// ...

function initWebSocketServer(server) {
  const wsServer = new WebSocketServer({ httpServer: server });

  wsServer.on("request", async (request) => {
    // ... 기존 handshake 로직 동일
    // handshake 후 connection 생성:
    const user_id = request.resourceURL.query.user_id;
    const connection = request.accept(null, request.origin);
    connections.set(user_id, connection);

    connection.on("message", async (message) => {
      if (message.type !== "utf8") return;
      try {
        const data = JSON.parse(message.utf8Data);
        switch (data.type) {
          case "randomStartEnd":
            await routeHandler.handleRandomStartEnd(user_id, data.payload);
            break;
          case "requestRoute":
            await routeHandler.handleRequestRoute(user_id, data.payload);
            break;
          // ... 위치 업데이트, 채팅 등은 기존 로직 사용
          default:
            console.warn("Unknown message type:", data.type);
            break;
        }
      } catch (e) {
        console.error("Invalid WS message:", e);
      }
    });

    connection.on("close", () => {
      console.log(`[WS] Connection closed for user_id: ${user_id}`);
      connections.delete(user_id);
    });
  });
}

module.exports = {
  initWebSocketServer,
  broadcast,
  sendToUser,
};
