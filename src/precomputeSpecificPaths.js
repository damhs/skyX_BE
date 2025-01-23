const { client } = require("./redis.js");
const pool = require("./mysql.js");
const {
  getAllObstacles,
  findPath3D,
  collideObstacle,
} = require("./Service/pathService.js");

// Building 정보 가져오기
async function getBuildingById(buildingID) {
  const [rows] = await pool.query("SELECT * FROM Building WHERE buildingID = ?", [buildingID]);
  if (rows.length === 0) {
    throw new Error(`Building with ID ${buildingID} not found`);
  }
  const building = rows[0];
  return {
    lat: Number(building.latitude),
    lon: Number(building.longitude),
  };
}

// 사전 계산 함수 (특정 루트만)
async function precomputeSpecificPaths() {
  try {
    console.log("[Precompute] Connecting to Redis...");
    await client.connect();

    console.log("[Precompute] Getting obstacles...");
    const obstacles = await getAllObstacles();

    // stepDist 등 파라미터
    const maxAlt = 200;
    const stepDist = 8.33; // 30km/h

    // 특정 루트 정의
    const specificRoutes = [
      { originID: "4de6f5e7-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6f8e3-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6f35c-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6f164-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6f960-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6fad5-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6fa56-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6fc47-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6ee85-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6ed8d-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6ef00-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6eb95-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6eb0b-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6e778-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6dbbe-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6d2c8-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6df01-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6e10d-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6ee07-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6e678-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6f0e4-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6fcc3-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6e87e-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6ef7d-d7c0-11ef-8650-fa163e2f32e9" },
      { originID: "4de6e3df-d7c0-11ef-8650-fa163e2f32e9", destinationID: "4de6e4ed-d7c0-11ef-8650-fa163e2f32e9" } // 내가 쓸 루트
    ];

    // 루트 계산
    let count = 0;
    for (const route of specificRoutes) {
      const { originID, destinationID } = route;

      // Redis 키: 정방향 및 역방향 경로
      const keyForward = `path:${originID}:${destinationID}`;
      const keyReverse = `path:${destinationID}:${originID}`;

      // Redis에 경로 존재 여부 확인
      const existsForward = await client.exists(keyForward);
      const existsReverse = await client.exists(keyReverse);

      if (existsForward || existsReverse) {
        console.log(`[Precompute] Skipping ${originID} -> ${destinationID}, path already exists.`);
        continue; // 경로가 이미 존재하면 건너뜀
      }

      // Building 정보 가져오기
      const startBuilding = await getBuildingById(originID);
      const endBuilding = await getBuildingById(destinationID);

      // 출발지/도착지 고도를 장애물 height + 10으로 설정
      const startObstacle = obstacles.find((o) =>
        collideObstacle(startBuilding.lat, startBuilding.lon, 0, o)
      );
      const endObstacle = obstacles.find((o) =>
        collideObstacle(endBuilding.lat, endBuilding.lon, 0, o)
      );

      const startAlt = startObstacle ? startObstacle.height + 10 : 100;
      const endAlt = endObstacle ? endObstacle.height + 10 : 100;

      const start = {
        lat: startBuilding.lat,
        lon: startBuilding.lon,
        alt: startAlt,
      };
      const end = {
        lat: endBuilding.lat,
        lon: endBuilding.lon,
        alt: endAlt,
      };

      // 경로 계산
      try {
        const path = await findPath3D(start, end, obstacles, maxAlt, stepDist);
        path.push(end); // 도착지 추가

        // 역방향 경로 생성
        const reversePath = [...path].reverse();

        // Redis 저장
        await client.set(keyForward, JSON.stringify(path));
        await client.set(keyReverse, JSON.stringify(reversePath));

        console.log(`[Precompute] Stored paths for ${originID} -> ${destinationID} and reverse.`);
        count++;
      } catch (err) {
        console.warn(`[Precompute] Failed paths for ${originID} <-> ${destinationID}`, err);
        await client.set(keyForward, "no_path");
        await client.set(keyReverse, "no_path");
      }
    }

    console.log(`[Precompute] All done. Computed ${count} specific routes.`);
    await client.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("[Precompute] Error:", err);
    process.exit(1);
  }
}

precomputeSpecificPaths();
