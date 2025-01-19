const redis = require("redis");

const client = redis.createClient({
  url: "redis://172.10.7.60:6379",
});

async function initRedis() {
  try {
    // Redis 연결
    await client.connect();
    console.log("Redis connected");

    // 연결 종료 이벤트 핸들링
    client.on("end", () => {
      console.warn("Redis connection closed.");
    });

    // 오류 이벤트 핸들링
    client.on("error", (err) => {
      console.error("Redis error:", err.message);
    });
  } catch (error) {
    console.error("Failed to connect to Redis:", error.message);
    throw error;
  }
}

module.exports = { client, initRedis };
