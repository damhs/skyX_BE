const WebSocketServer = require("websocket").server;
const { client } = require("./redis.js");
const routeHandler = require("./Handler/routeHandler.js");
const locationService = require("./Service/locationService.js");

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

function initWebSocketServer(server) {
  const wsServer = new WebSocketServer({ httpServer: server });

  wsServer.on("request", async (request) => {
    const user_id = request.resourceURL.query.user_id;
    const connection = request.accept(null, request.origin);
    connections.set(user_id, connection);

    console.log(`[WS] Connection established for user_id: ${user_id}`);

    connection.on("message", async (message) => {
      if (message.type !== "utf8") return;

      try {
        const data = JSON.parse(message.utf8Data);

        switch (data.type) {
          case "startLocationUpdates":
            // Unity로부터 지속적인 위치 수신 요청
            console.log(`[WS] Start location updates for user_id: ${user_id}`);
            break;

          case "stopLocationUpdates":
            // Unity가 위치 업데이트 중단 요청
            console.log(`[WS] Stop location updates for user_id: ${user_id}`);
            break;

          case "updateLocation":
            const { latitude, longitude, altitude } = data.payload;
            await locationService.postLocation(user_id, latitude, longitude, altitude);
            console.log(`[WS] Location updated for user_id: ${user_id}`);
            break;

          case "getLocation":
            const location = await locationService.getLocation(user_id);
            if (location) {
              sendToUser(user_id, {
                type: "locationData",
                payload: location,
              });
              console.log(`[WS] Location sent to user_id: ${user_id}`);
            }
            break;
          
          case "startAnimation":
            console.log(`[WS] Start animation for user_id: ${user_id}`);
            sendToUser(user_id, {
              type: "startAnimation",
            });
            break;
          
          case "startNavigation":
            console.log(`[WS] Start navigation for user_id: ${user_id}`);
            sendToUser(user_id, {
              type: "startNavigation",
            });
            break;

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

  // 1초마다 위치 정보를 브로드캐스트
  setInterval(async () => {
    for (const user_id of connections.keys()) {
      const location = await locationService.getLocation(user_id);
      if (location) {
        sendToUser(user_id, {
          type: "locationUpdate",
          payload: location,
        });
      }
    }
  }, 1000);
}


module.exports = {
  initWebSocketServer,
  broadcast,
  sendToUser,
};
