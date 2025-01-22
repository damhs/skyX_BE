// precomputePaths.js
const { client } = require("./redis.js");
const pool = require("./mysql.js"); // 기존 mysql 커넥션
const {
  getAllObstacles,
  getAllBuildings,
  findPath3D,
  collideObstacle,
} = require("./Service/pathService.js"); // pathService에 findPath3D 등 정의

// 사전 계산 함수
async function precomputeAllPaths() {
  try {
    console.log("[Precompute] Connecting to Redis...");
    await client.connect();

    console.log("[Precompute] Getting building list...");
    const buildings = await getAllBuildings();

    console.log("[Precompute] Getting obstacles...");
    const obstacles = await getAllObstacles();

    // stepDist 등 파라미터
    const maxAlt = 200;
    const stepDist = 8.33; // 30km/h

    // 모든 쌍(65C2) 경로 계산
    console.log("[Precompute] Start computing paths for all building pairs...");
    let count = 0;

    for (let i = 0; i < buildings.length; i++) {
      for (let j = i + 1; j < buildings.length; j++) {
        const b1 = buildings[i];
        const b2 = buildings[j];

        const originID = b1.buildingID;
        const destinationID = b2.buildingID;

        // 출발지/도착지 고도를 장애물 height + 10으로 설정
        const startObstacle = obstacles.find((o) =>
          collideObstacle(b1.lat, b1.lon, 0, o)
        );
        const endObstacle = obstacles.find((o) =>
          collideObstacle(b2.lat, b2.lon, 0, o)
        );

        const startAlt = startObstacle.height + 10;
        const endAlt = endObstacle.height + 10;

        const start = {
          lat: b1.lat,
          lon: b1.lon,
          alt: startAlt,
        };
        const end = {
          lat: b2.lat,
          lon: b2.lon,
          alt: endAlt,
        };

        // 경로 계산 (Promise)
        try {
          // 정방향 경로 계산
          const path = await findPath3D(start, end, obstacles, maxAlt, stepDist);
          path.push(end); // 도착지 추가

          // 역방향 경로 생성 (정방향 경로를 뒤집음)
          const reversePath = [...path].reverse();

          // Redis 키: 정방향 및 역방향 경로
          const keyForward = `path:${originID}:${destinationID}`;
          const keyReverse = `path:${destinationID}:${originID}`;

          // Redis 저장
          await client.set(keyForward, JSON.stringify(path));
          await client.set(keyReverse, JSON.stringify(reversePath));

          console.log(`[Precompute] Stored paths for ${originID} -> ${destinationID} and reverse.`);
        } catch (err) {
          console.warn(`[Precompute] Failed paths for ${originID} <-> ${destinationID}`, err);
          // Redis에 "no_path" 등으로 표시
          const keyForward = `path:${originID}:${destinationID}`;
          const keyReverse = `path:${destinationID}:${originID}`;
          await client.set(keyForward, "no_path");
          await client.set(keyReverse, "no_path");
        }

        count++;
      }
    }

    console.log(`[Precompute] All done. Computed ${count} pairs.`);
    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("[Precompute] Error:", err);
    process.exit(1);
  }
}

precomputeAllPaths();
