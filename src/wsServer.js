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

function handleMessage(user_id, message) {
  if (message.type === "utf8") {
    try {
      const data = JSON.parse(message.utf8Data);
      if (data.type === "chat") {
        broadcastMessage({ type: "chat", sender: user_id, message: data.payload });
      }
    } catch (error) {
      console.error("Invalid message format:", error);
    }
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
