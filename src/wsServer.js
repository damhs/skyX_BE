// src/wsServer.js
const WebSocketServer = require("websocket").server;
const { client } = require("./redis.js");

// 연결된 클라이언트(사용자)들을 저장: key는 user_id, value는 connection
const connections = new Map();

// -----------------------------------------------------
// 1. 경로 계산 함수 (예시)
// 실제 서비스에서는 지도/항로 API, 알고리즘 등을 통해 경로를 계산하세요.
// -----------------------------------------------------
function calculateRoute(start, end) {
  // start, end가 {lat, lng} 형태라고 가정
  // 단순 직선 보간 예시
  const route = [];
  const steps = 5; // 임의 단계 수
  const latStep = (end.lat - start.lat) / steps;
  const lngStep = (end.lng - start.lng) / steps;

  for (let i = 0; i <= steps; i++) {
    route.push({
      lat: start.lat + latStep * i,
      lng: start.lng + lngStep * i,
    });
  }
  return route;
}

function initWebSocketServer(server) {
  const wsServer = new WebSocketServer({ httpServer: server });

  wsServer.on("request", async (request) => {
    // 디버깅: 들어오는 요청 URL 확인
    console.log("[WS] New handshake request URL:", request.httpRequest.url);

    // URL 예: /api/auth/signIn?user_id=카카오ID_혹은_랜덤ID
    // 쿼리 파싱
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

    // (선택) Redis에 유저 초깃값 저장
    try {
      await client.hSet(`user:${user_id}`, {
        latitude: "0",
        longitude: "0",
        altitude: "0",
        direction: "0",
        speed: "0",
        updatedAt: String(Date.now()),
      });
      console.log(`[WS] Stored user ${user_id} in Redis with default location data`);
    } catch (redisError) {
      console.error(`[WS] Failed to store user in Redis: ${redisError}`);
    }

    // WebSocket 메시지 핸들러
    connection.on("message", (message) => {
      handleMessage(user_id, message);
    });

    connection.on("close", () => {
      console.log(`[WS] Connection closed for user_id: ${user_id}`);
      connections.delete(user_id);
    });
  });
}

// -----------------------------------------------------
// 메시지 파싱 및 분기 처리
// -----------------------------------------------------
function handleMessage(user_id, message) {
  if (message.type !== "utf8") return;

  try {
    const data = JSON.parse(message.utf8Data);

    switch (data.type) {
      // 2. Unity(시뮬)에서 랜덤 출발점/도착점 전송 => 경로 계산
      //    예: { type: "randomStartEnd", payload: { start: {lat, lng}, end: {lat, lng} } }
      case "randomStartEnd": {
        const { start, end } = data.payload;
        console.log(`[WS] [${user_id}] randomStartEnd:`, start, end);

        const route = calculateRoute(start, end);

        // 3. 경로를 Unity에게 다시 전송
        sendToUser(user_id, {
          type: "routeData",
          payload: {
            user_id,
            route,
          },
        });
        break;
      }

      // 7. Flutter(실사용자)에서 출발점/도착점 => BE 전송
      //    예: { type: "requestRoute", payload: { start: {lat, lng}, end: {lat, lng} } }
      case "requestRoute": {
        const { start, end } = data.payload;
        console.log(`[WS] [${user_id}] requestRoute:`, start, end);

        // 8. 경로 계산 후 FE와 U에 전달
        const route = calculateRoute(start, end);

        // 8-1) FE(본인)에게 전송
        sendToUser(user_id, {
          type: "routeData",
          payload: {
            user_id,
            route,
          },
        });

        // 8-2) Unity(시뮬)에 전송 (유저 비행체 생성)
        //     실제 구현에선 Unity만 구독 중인 Room이나,
        //     또는 Unity 쪽 user_id가 특정 prefix로 구분되어 있다면
        //     해당 유저에게만 보내는 로직을 구현할 수 있음.
        //     여기서는 간단히 전체 broadcast 예시
        broadcast({
          type: "routeData",
          payload: {
            user_id,
            route,
          },
        });
        break;
      }

      // 9. Unity(시뮬) → BE: 비행체 위치 업데이트
      //    예: { type: "updatePosition", payload: { lat, lng, ... } }
      case "updatePosition": {
        const { lat, lng, altitude, direction, speed } = data.payload;
        saveUserLocationToRedis(user_id, { lat, lng, altitude, direction, speed });
        // 10. BE -> FE: 위치 전송 (실시간 네비)
        broadcast({
          type: "positionUpdate",
          payload: {
            user_id,
            lat,
            lng,
            altitude,
            direction,
            speed,
          },
        });
        break;
      }

      // (기존) 위치 업데이트 예시
      // { type: "location_update", payload: {...} }
      case "location_update": {
        const { latitude, longitude, altitude, direction, speed } = data.payload;
        saveUserLocationToRedis(user_id, { 
          lat: latitude, 
          lng: longitude, 
          altitude, 
          direction, 
          speed 
        });

        // 위치 브로드캐스트
        broadcast({
          type: "positionUpdate",
          payload: {
            user_id,
            lat: latitude,
            lng: longitude,
            altitude,
            direction,
            speed,
          },
        });
        break;
      }

      // (추가 예시) 채팅
      case "chat": {
        const chatMessage = data.payload;
        broadcast({
          type: "chat",
          payload: {
            sender: user_id,
            message: chatMessage,
          },
        });
        break;
      }

      default:
        console.warn("Unknown message type:", data.type);
        break;
    }
  } catch (error) {
    console.error("Invalid message format:", error);
  }
}

// -----------------------------------------------------
// Redis에 위치 데이터 저장
// -----------------------------------------------------
async function saveUserLocationToRedis(userId, { lat, lng, altitude, direction, speed }) {
  try {
    await client.hSet(`user:${userId}`, {
      latitude: String(lat),
      longitude: String(lng),
      altitude: String(altitude || 0),
      direction: String(direction || 0),
      speed: String(speed || 0),
      updatedAt: String(Date.now()),
    });
    console.log(`[WS] Updated location for user_id=${userId} in Redis.`);
  } catch (error) {
    console.error("Failed to save user location:", error);
  }
}

// -----------------------------------------------------
// 특정 유저에게만 메시지 전송
// -----------------------------------------------------
function sendToUser(user_id, messageObj) {
  const connection = connections.get(user_id);
  if (connection && connection.connected) {
    connection.sendUTF(JSON.stringify(messageObj));
  }
}

// -----------------------------------------------------
// 전체 또는 특정 그룹에 브로드캐스트 (예시: 전체)
// -----------------------------------------------------
function broadcast(messageObj) {
  for (const [uid, conn] of connections.entries()) {
    if (conn.connected) {
      conn.sendUTF(JSON.stringify(messageObj));
    }
  }
}

// -----------------------------------------------------
function parseQueryParams(url) {
  const query = url.split("?")[1];
  if (!query) return {};
  const params = new URLSearchParams(query);
  return Object.fromEntries(params.entries());
}

module.exports = { initWebSocketServer };
