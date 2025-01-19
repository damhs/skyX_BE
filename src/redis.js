const redis = require("redis");

// Redis 클라이언트 초기화 함수
const client = redis.createClient({
  url: "redis://172.10.7.60:6379",
});

async function initRedis() {
  try {
    await client.connect(); // Redis 연결
    console.log("Redis connected");
  } catch (error) {
    throw new Error("Failed to connect to Redis: " + error.message);
  }
}

module.exports = { client, initRedis };
