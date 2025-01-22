// Service/pathService.js
const pool = require("../mysql.js");
const uuid = require("uuid-sequential");

// ==================== DB 조회 ====================

/** Obstacle 테이블에서 장애물(원기둥) 목록 조회 */
async function getAllObstacles() {
  console.log("[DBG] getAllObstacles() called");
  const [rows] = await pool.query("SELECT * FROM Obstacle");
  console.log(`[DBG] Obstacle rows length: ${rows.length}`);
  const obstacles = rows.map((o) => ({
    obstacleID: o.obstacleID,
    name: o.obstacleName,
    lat: Number(o.latitude),
    lon: Number(o.longitude),
    radius: Number(o.radius),
    height: Number(o.height),
  }));
  // console.log("[DBG] obstacles:", obstacles);
  return obstacles;
}

/** Building 테이블에서 모든 건물 조회 (참고용) */
async function getAllBuildings() {
  console.log("[DBG] getAllBuildings() called");
  const [rows] = await pool.query("SELECT * FROM Building");
  console.log(`[DBG] Building rows length: ${rows.length}`);
  const buildings = rows.map((b) => ({
    buildingID: b.buildingID,
    name: b.buildingName,
    lat: Number(b.latitude),
    lon: Number(b.longitude),
    alt: Number(b.altitude),
  }));
  return buildings;
}

/** 특정 buildingID에 해당하는 건물(출발지,도착지) 정보 반환 */
async function getBuilding(buildingID) {
  console.log("[DBG] getBuilding() called with buildingID =", buildingID);
  const [rows] = await pool.query(
    "SELECT * FROM Building WHERE buildingID = ?",
    [buildingID]
  );
  console.log(`[DBG] getBuilding() result rows: ${rows.length}`);
  if (rows.length === 0) {
    console.log("[DBG] No building found for ID:", buildingID);
    return null;
  }
  const b = rows[0];
  const building = {
    buildingID: b.buildingID,
    lat: Number(b.latitude),
    lon: Number(b.longitude),
  };
  console.log("[DBG] Found building:", building);
  return building;
}

// ==================== Haversine + 3D 거리 ====================

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 반경(m)
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) *
      Math.cos(lat2 * toRad) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meters
}

function distance3D(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dist2D = haversineDistance(lat1, lon1, lat2, lon2);
  const dAlt = alt2 - alt1;
  return Math.sqrt(dist2D * dist2D + dAlt * dAlt);
}

// ==================== 장애물(원기둥) 충돌 판정 ====================
function collideObstacle(lat, lon, alt, obstacle) {
  const dist2D = haversineDistance(lat, lon, obstacle.lat, obstacle.lon);
  const collision = dist2D <= obstacle.radius && alt >= 0 && alt <= obstacle.height;
  if (collision) {
    console.log(`[DBG] Collision detected at lat: ${lat}, lon: ${lon}, alt: ${alt} with obstacle at lat: ${obstacle.lat}, lon: ${obstacle.lon}, height: ${obstacle.height}`);
  }
  return collision;
}

// ==================== 3D A* 알고리즘 (디버깅 추가) ====================

function findPath3D(start, end, obstacles, maxAlt = 200, stepDist = 5) {
  console.log("[DBG] findPath3D() start");
  console.log("[DBG] start =", start, "end =", end);
  console.log(`[DBG] obstacles count = ${obstacles.length}, maxAlt=${maxAlt}, stepDist=${stepDist}`);

  const openSet = [];
  const cameFrom = new Map(); // key: "lat,lon,alt"
  const gScore = new Map();

  const startState = {
    lat: parseFloat(start.lat.toFixed(5)),
    lon: parseFloat(start.lon.toFixed(5)),
    alt: start.alt || 0,
  };
  const endState = {
    lat: parseFloat(end.lat.toFixed(5)),
    lon: parseFloat(end.lon.toFixed(5)),
    alt: end.alt || 0,
  };

  const startKey = stateKey(startState);
  gScore.set(startKey, 0);
  openSet.push({
    ...startState,
    f: heuristic(startState, endState),
  });

  const visited = new Set();
  let iterationCount = 0;

  const interval = setInterval(() => {
    if (openSet.length === 0) {
      console.log("[DBG] No path found after exploring all possibilities.");
      clearInterval(interval);
      return [];
    }

    iterationCount++;
    // f값이 가장 낮은 노드를 pop
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currKey = stateKey(current);
    visited.add(currKey);

    // 100회마다 로그 출력 (이제 10회로 변경)
    if (iterationCount % 10 === 0) {
      console.log(`[DBG] Iteration ${iterationCount}, openSet size = ${openSet.length}`);
      console.log("[DBG] Current node =", current);
    }

    // 도착 판정(목표와 5m 이내면 도달)
    const distGoal = distance3D(
      current.lat,
      current.lon,
      current.alt,
      endState.lat,
      endState.lon,
      endState.alt
    );
    if (distGoal < 5) {
      console.log("[DBG] Goal reached! distGoal =", distGoal);
      const pathFound = reconstructPath(cameFrom, current);
      console.log("[DBG] Path length =", pathFound.length);
      clearInterval(interval);
      return pathFound;
    }

    // 이웃 상태
    const neighbors = getNeighbors(current, stepDist, maxAlt);
    for (const nb of neighbors) {
      const nbKey = stateKey(nb);
      if (visited.has(nbKey)) {
        continue;
      }

      // 장애물 충돌 체크
      const collision = obstacles.some((obs) =>
        collideObstacle(nb.lat, nb.lon, nb.alt, obs)
      );
      if (collision) {
        // 장애물에 충돌할 경우, 방향을 바꾸거나 고도를 상승
        continue; // 다른 방향으로 이동하는 로직 추가 가능
      }

      // 이동 비용
      const moveCost = distance3D(
        current.lat,
        current.lon,
        current.alt,
        nb.lat,
        nb.lon,
        nb.alt
      );
      const costSoFar = gScore.get(currKey) || Infinity;
      const tentativeG = costSoFar + moveCost;
      const oldG = gScore.get(nbKey) || Infinity;

      if (tentativeG < oldG) {
        cameFrom.set(nbKey, currKey);
        gScore.set(nbKey, tentativeG);
        const fVal = tentativeG + heuristic(nb, endState);

        const idx = openSet.findIndex((o) => stateKey(o) === nbKey);
        if (idx >= 0) {
          openSet[idx].f = fVal;
        } else {
          openSet.push({ ...nb, f: fVal });
        }
      }
    }
  }, 100); // 0.1초 간격으로 반복
}



function getNeighbors(state, stepDist, maxAlt) {
  const latStep = 0.00005;
  const lonStep = 0.00005;
  const altStep = 10; // 10m
  const { lat, lon, alt } = state;

  const deltas = [
    [0, 0],
    [latStep, 0],
    [-latStep, 0],
    [0, lonStep],
    [0, -lonStep],
    [latStep, lonStep],
    [latStep, -lonStep],
    [-latStep, lonStep],
    [-latStep, -lonStep],
  ];

  const neighbors = [];
  for (const [dLat, dLon] of deltas) {
    for (const dAlt of [0, altStep, -altStep]) {
      const nextAlt = alt + dAlt;
      if (nextAlt < 0 || nextAlt > maxAlt) continue;
      const newLat = parseFloat((lat + dLat).toFixed(5));
      const newLon = parseFloat((lon + dLon).toFixed(5));

      const dist3d = distance3D(lat, lon, alt, newLat, newLon, nextAlt);
      if (dist3d <= stepDist + 0.001) {
        neighbors.push({
          lat: newLat,
          lon: newLon,
          alt: nextAlt,
        });
      }
    }
  }
  return neighbors;
}

function heuristic(a, b) {
  return distance3D(a.lat, a.lon, a.alt, b.lat, b.lon, b.alt);
}

function stateKey(s) {
  return `${s.lat},${s.lon},${s.alt}`;
}

function reconstructPath(cameFrom, current) {
  const path = [];
  let key = stateKey(current);

  while (cameFrom.has(key)) {
    const [lat, lon, alt] = key.split(",").map(Number);
    path.unshift({ lat, lon, alt });
    key = cameFrom.get(key);
  }
  // start
  const [slat, slon, salt] = key.split(",").map(Number);
  path.unshift({ lat: slat, lon: slon, alt: salt });

  return path;
}

// ==================== 서비스 로직 ====================

// ==================== 서비스 로직 ====================

/**
 * 출발 건물(originID), 도착 건물(destinationID)를 받아
 * - 장애물 테이블에서 장애물들 조회
 * - Building 테이블에서 출발/도착 lat, lon을 통해 장애물의 height를 고도로 사용
 * - 3D A* 알고리즘으로 경로 생성
 * - 경로를 반환
 */
async function planSinglePathIgnoringOtherAgents(originID, destinationID) {
  // 1) 장애물 정보
  const obstacles = await getAllObstacles();

  // 2) 출발지/도착지 건물
  const startBuilding = await getBuilding(originID);
  const endBuilding = await getBuilding(destinationID);

  if (!startBuilding || !endBuilding) {
    throw new Error("Invalid building ID(s)");
  }

  // 3) 출발지 장애물 높이 설정
  const startObstacle = obstacles.find(o => collideObstacle(startBuilding.lat, startBuilding.lon, 0, o));
  const startAlt = startObstacle.height; // 장애물의 height를 출발지 고도로 설정
  const start = { lat: startBuilding.lat, lon: startBuilding.lon, alt: startAlt + 10 }; // 10m 상승

  // 4) 도착지 장애물 높이 설정
  const endObstacle = obstacles.find(o => collideObstacle(endBuilding.lat, endBuilding.lon, 0, o));
  const endAlt = endObstacle.height; // 장애물의 height를 도착지 고도로 설정
  const end = { lat: endBuilding.lat, lon: endBuilding.lon, alt: endAlt + 10 }; // 10m 상승

  // 5) 3D A* 경로 탐색
  const stepDist = 10;
  const maxAlt = 200; // 예시로 최대 고도는 200m로 설정

  const path = findPath3D(start, end, obstacles, maxAlt, stepDist);

  // 도착 후 마지막 10m 하강
  if (path.length > 0) {
    const lastPoint = path[path.length - 1];
    lastPoint.alt = endAlt; // 도착지 고도로 10m 하강 후 최종 도달
  }

  return path; // 경로 반환
}


async function insertFlight(id, originID, destinationID) {
  console.log("[DBG] insertFlight() called with", { id, originID, destinationID });
  const updatedAt = new Date();

  const [rows] = await pool.query(
    "SELECT * FROM Flight WHERE id = ? AND originID = ? AND destinationID = ?",
    [id, originID, destinationID]
  );
  if (rows.length > 0) {
    console.log("[DBG] Flight record exists, updating updatedAt only");
    await pool.query(
      "UPDATE Flight SET updatedAt = ? WHERE id = ? AND originID = ? AND destinationID = ?",
      [updatedAt, id, originID, destinationID]
    );
    return rows[0].flightID;
  } else {
    console.log("[DBG] Flight record not found, inserting new row");
    const flightID = uuid();
    await pool.query(
      "INSERT INTO Flight (flightID, id, originID, destinationID, updatedAt) VALUES (?, ?, ?, ?, ?)",
      [flightID, id, originID, destinationID, updatedAt]
    );
    return flightID;
  }
}

module.exports = {
  planSinglePathIgnoringOtherAgents,
  insertFlight,
};
