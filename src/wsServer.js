const WebSocketServer = require("websocket").server;
const { validateUser } = require("./Handler/userHandler");

const connections = new Map(); // 연결된 클라이언트 저장

function initWebSocketServer(server) {
  const wsServer = new WebSocketServer({ httpServer: server });

  wsServer.on("request", async (request) => {
    const user_id = parseQueryParams(request.httpRequest.url).user_id;

    if (!user_id) {
      request.reject(400, "Missing user_id");
      return;
    }

    try {
      const isValidUser = await validateUser(user_id);
      if (!isValidUser) {
        request.reject(400, "Invalid user_id");
        return;
      }
    } catch (error) {
      request.reject(500, "Internal Server Error");
      return;
    }

    const connection = request.accept(null, request.origin);
    connections.set(user_id, connection);

    connection.on("message", (message) => handleMessage(user_id, message));
    connection.on("close", () => connections.delete(user_id));
  });
}

function parseQueryParams(url) {
  const query = url.split("?")[1];
  const params = new URLSearchParams(query);
  return Object.fromEntries(params.entries());
}

// 예시) wsServer.on("request", ...) 내부에 message 핸들러
function handleMessage(user_id, message) {
  if (message.type === "utf8") {
    try {
      const data = JSON.parse(message.utf8Data);

      // location_update 타입일 경우
      if (data.type === "location_update") {
        const { latitude, longitude, altitude, direction, speed } = data.payload;
        
        // Redis에 저장
        saveUserLocationToRedis(user_id, { 
          latitude, 
          longitude, 
          altitude, 
          direction, 
          speed 
        });
        
        // 필요하다면 다른 사용자에게 브로드캐스트
        // broadcastMessage({ type: "location_update", user_id, payload: {...} });
      }
      // 채팅 등 다른 타입 처리
      else if (data.type === "chat") {
        broadcastMessage({ type: "chat", sender: user_id, message: data.payload });
      }

    } catch (error) {
      console.error("Invalid message format:", error);
    }
  }
}

async function saveUserLocationToRedis(userId, { latitude, longitude, altitude, direction, speed }) {
  try {
    // Hash 구조: user:{userId}
    await client.hSet(`user:${userId}`, {
      latitude: String(latitude),
      longitude: String(longitude),
      altitude: String(altitude),
      direction: String(direction),
      speed: String(speed),
      updatedAt: String(Date.now()) // 갱신 시간(타임스탬프)도 함께 저장
    });
  } catch (error) {
    console.error("Failed to save user location:", error);
  }
}

function broadcastMessage(message) {
  for (const conn of connections.values()) {
    if (conn.connected) {
      conn.sendUTF(JSON.stringify(message));
    }
  }
}

module.exports = { initWebSocketServer };
