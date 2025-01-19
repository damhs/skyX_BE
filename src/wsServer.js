const WebSocketServer = require("websocket").server;
const { validateUser } = require("./Handler/userHandler");
const { client } = require("./redis.js");

const connections = new Map(); // 연결된 클라이언트 저장

function initWebSocketServer(server) {
  const wsServer = new WebSocketServer({ httpServer: server });

  wsServer.on("request", async (request) => {
    // 디버깅: 들어오는 요청 URL 확인
    console.log("[WS] New handshake request URL:", request.httpRequest.url);

    // 예: /api/auth/signIn?user_id=홍길동
    // query 파싱
    const queryParams = parseQueryParams(request.httpRequest.url);
    const user_id = queryParams.user_id;
    console.log("[WS] user_id query param:", user_id);

    // user_id가 없는 경우 거부
    if (!user_id) {
      console.log("[WS] No user_id provided. Rejecting handshake.");
      request.reject(400, "Missing user_id");
      return;
    }

    // DB 또는 다른 로직에서 user_id 유효성 검증
    try {
      const isValidUser = await validateUser(user_id);
      if (!isValidUser) {
        console.log("[WS] Invalid user_id. Rejecting handshake.");
        request.reject(400, "Invalid user_id");
        return;
      }
    } catch (error) {
      console.error("[WS] Error validating user:", error);
      request.reject(500, "Internal Server Error");
      return;
    }

    // 핸드셰이크 승인
    const connection = request.accept(null, request.origin);
    console.log(`[WS] Handshake accepted for user_id: ${user_id}`);

    // 연결 관리용 Map에 저장
    connections.set(user_id, connection);

    // (선택) Redis에 기본 위치데이터를 미리 저장해놓고 싶다면:
    try {
      await client.hSet(`user:${user_id}`, {
        latitude: "0",
        longitude: "0",
        altitude: "0",
        direction: "0",
        speed: "0",
        updatedAt: String(Date.now()) // 갱신 시간(타임스탬프)
      });
      console.log(`[WS] Stored user ${user_id} in Redis with default location data`);
    } catch (redisError) {
      console.error(`[WS] Failed to store user in Redis: ${redisError}`);
    }

    // 이후 message, close 등 이벤트 핸들링
    connection.on("message", (message) => handleMessage(user_id, message));
    connection.on("close", () => {
      console.log(`[WS] Connection closed for user_id: ${user_id}`);
      connections.delete(user_id);
    });
  });
}

function parseQueryParams(url) {
  const query = url.split("?")[1];
  if (!query) return {};
  const params = new URLSearchParams(query);
  return Object.fromEntries(params.entries());
}

function handleMessage(user_id, message) {
  if (message.type === "utf8") {
    try {
      const data = JSON.parse(message.utf8Data);

      // 위치 업데이트
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
      }
      // 채팅
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
      updatedAt: String(Date.now()) // 갱신 시간
    });
    console.log(`[WS] Updated location for user_id=${userId} in Redis.`);
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
