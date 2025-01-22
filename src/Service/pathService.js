const pool = require("../mysql.js");
const uuid = require("uuid-sequential");

/**
 * ============================
 * 1) DB 조회 함수들
 * ============================
 */

/** Obstacle 테이블에서 장애물(원기둥) 목록 조회 */
async function getAllObstacles() {
  console.log("[DBG] getAllObstacles() called");
  const [rows] = await pool.query("SELECT * FROM Obstacle");
  console.log(`[DBG] Obstacle rows length: ${rows.length}`);

  // DB에서 가져온 필드를 Number 변환
  const obstacles = rows.map((o) => ({
    obstacleID: o.obstacleID,
    name: o.obstacleName,
    lat: Number(o.latitude),
    lon: Number(o.longitude),
    radius: Number(o.radius),
    height: Number(o.height),
  }));
  return obstacles;
}

/** Building 테이블에서 특정 buildingID(출발/도착지)를 찾는다 */
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

/**
 * ============================
 * 2) 거리 계산 함수들
 * ============================
 */

/**
 * Equirectangular Approximation 거리 계산
 */
function equirectangularDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 평균 반지름(m)
  const toRad = Math.PI / 180;
  const x = (lon2 - lon1) * toRad * Math.cos(((lat1 + lat2) / 2) * toRad);
  const y = (lat2 - lat1) * toRad;
  return Math.sqrt(x * x + y * y) * R;
}

/**
 * (lat1, lon1, alt1)와 (lat2, lon2, alt2)의 3D 거리(m)
 *  => sqrt( (2D 거리)^2 + (고도차)^2 )
 */
function distance3D(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dist2D = equirectangularDistance(lat1, lon1, lat2, lon2);
  const dAlt = alt2 - alt1;
  return Math.sqrt(dist2D * dist2D + dAlt * dAlt);
}

/**
 * ============================
 * 3) 장애물(원기둥) 충돌 판정
 * ============================
 *
 * Obstacle: { lat, lon, radius, height }
 * => 원기둥의 중심(lat, lon), 반경(radius), 높이(height)
 * (x,y) 수평거리 <= radius && 고도(alt)가 [0, height] 범위면 충돌
 */
function collideObstacle(lat, lon, alt, obstacle) {
  const dist2D = equirectangularDistance(lat, lon, obstacle.lat, obstacle.lon);
  const collision =
    dist2D <= obstacle.radius && alt >= 0 && alt <= obstacle.height;

  if (collision) {
    console.log(
      `[DBG] Collision detected at lat:${lat}, lon:${lon}, alt:${alt} ` +
        `with obstacle lat:${obstacle.lat}, lon:${obstacle.lon}, radius:${obstacle.radius}, height:${obstacle.height}`
    );
  }
  return collision;
}

/**
 * ============================
 * 4) 3D A* 알고리즘 (Promise 버전)
 * ============================
 *
 *  - 26방향 이동
 *  - 속도 30km/h ≈ 8.33m/s => stepDist = 8.33
 *  - 0.1초(100ms) 간격으로 탐색 진행
 *  - 경로 찾으면 resolve(path), 못 찾으면 reject
 */
function findPath3D(start, end, obstacles, maxAlt, stepDist) {
  // Promise로 감싸서, setInterval에서 경로를 찾으면 resolve, 실패면 reject
  return new Promise((resolve, reject) => {
    console.log("[DBG] findPath3D() start");
    console.log("[DBG] start =", start, "end =", end);
    console.log(
      `[DBG] obstacles count = ${obstacles.length}, maxAlt=${maxAlt}, stepDist=${stepDist}`
    );

    // openSet, cameFrom, gScore
    const openSet = [];
    const cameFrom = new Map();
    const gScore = new Map();

    const startState = {
      lat: parseFloat(start.lat.toFixed(10)),
      lon: parseFloat(start.lon.toFixed(10)),
      alt: start.alt || 0,
    };
    const endState = {
      lat: parseFloat(end.lat.toFixed(10)),
      lon: parseFloat(end.lon.toFixed(10)),
      alt: end.alt || 0,
    };

    const startKey = stateKey(startState);
    gScore.set(startKey, 0);
    console.log("[DBG] startState =", startState, "endState =", endState);
    console.log("[DBG] gScore =", gScore);

    openSet.push({
      ...startState,
      f: heuristic(startState, endState),
    });

    console.log("[DBG] Initial openSet:", openSet);

    const visited = new Set();
    let iterationCount = 0;

    // 0.1초마다(100ms) A* 탐색을 한 스텝씩 진행
    const interval = setInterval(() => {
      // (1) openSet이 비었으면 경로 X
      if (openSet.length === 0) {
        console.log("[DBG] No path found after exploring all possibilities.");
        clearInterval(interval);
        return reject(new Error("No path found"));
      }

      iterationCount++;

      // (2) f값이 가장 낮은 노드를 pop
      openSet.sort((a, b) => a.f - b.f);
      const current = openSet.shift();
      const currKey = stateKey(current);
      console.log("[DBG] current node key =", currKey);

      if (visited.has(currKey)) {
        // 이미 방문한 노드라면 건너뜀
        return;
      }
      visited.add(currKey);

      console.log(
        `[DBG] Iteration ${iterationCount}, openSet size = ${openSet.length}`
      );
      console.log("[DBG] Current node =", current);

      // (4) 도착 판정: endState와 5m 이하 거리면 도달
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

        // 경로 복원
        const pathFound = reconstructPath(cameFrom, current);
        console.log("[DBG] Path length =", pathFound.length);

        clearInterval(interval);
        return resolve(pathFound); // Promise 성공
      }

      // (5) 이웃(26방향) 탐색
      const neighbors = getNeighbors26(current, stepDist, maxAlt);
      console.log(`[DBG] Generated ${neighbors.length} neighbors for current node.`);
      for (const nb of neighbors) {
        const nbKey = stateKey(nb);

        if (visited.has(nbKey)) continue;

        // 장애물 충돌 체크
        const collision = obstacles.some((obs) =>
          collideObstacle(nb.lat, nb.lon, nb.alt, obs)
        );
        if (collision) {
          continue;
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
        const costSoFar = gScore.get(currKey);
        const tentativeG = costSoFar + moveCost;
        const oldG = gScore.get(nbKey) || Infinity;
        console.log("[DBG] costSoFar =", costSoFar, "moveCost =", moveCost);
        console.log("[DBG] tentativeG =", tentativeG, "oldG =", oldG);

        // 더 나은 경로
        if (tentativeG < oldG) {
          cameFrom.set(nbKey, currKey);
          gScore.set(nbKey, tentativeG);

          const fVal = tentativeG + heuristic(nb, endState);

          const idx = openSet.findIndex((o) => stateKey(o) === nbKey);
          if (idx >= 0) {
            openSet[idx].f = fVal;
          } else {
            // visited.add(nbKey);
            openSet.push({ ...nb, f: fVal });
          }
        }
      }
    }, 100); // 0.1초 간격
  });
}

/**
 * 26방향 이웃 노드 생성:
 *   3D에서 (dx,dy,dz)가 -1,0,+1 조합 중 (0,0,0) 제외하면 26방향.
 *   각 방향으로 이동 후, 실제 이동거리가 stepDist(8.33m)이하이면 OK
 */
function getNeighbors26(state, stepDist, maxAlt) {
  const { lat, lon, alt } = state;

  // 이동 스텝 재조정
  const latStep = 0.00005;
  const lonStep = 0.00005;
  const altStep = 5; // 5m로 감소

  // 26방향 생성
  const directions = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dy === 0 && dz === 0) continue;
        directions.push([dx, dy, dz]);
      }
    }
  }

  const neighbors = [];

  for (const [dx, dy, dz] of directions) {
    // 새 좌표 계산
    const newLat = parseFloat((lat + dx * latStep).toFixed(10));
    const newLon = parseFloat((lon + dy * lonStep).toFixed(10));
    const newAlt = alt + dz * altStep;

    // 고도 범위 초과 시 제외
    if (newAlt < 0 || newAlt > maxAlt + 20) {
      console.log("[DBG] Neighbor discarded, alt out of range:", newAlt);
      continue;
    }

    // 실제 3D 이동거리가 stepDist(=8.33m) 이하인지 확인
    const dist = distance3D(lat, lon, alt, newLat, newLon, newAlt);
    if (dist <= stepDist + 0.001) {
      neighbors.push({ lat: newLat, lon: newLon, alt: newAlt });
      console.log(`[DBG] Neighbor added: lat=${newLat}, lon=${newLon}, alt=${newAlt}, dist=${dist}`);
    } else {
      console.log("[DBG] Neighbor discarded, distance too large:", dist);
    }
  }
  return neighbors;
}

/**
 * 휴리스틱: 현재 ~ 목표까지의 3D 직선거리
 */
function heuristic(a, b) {
  return distance3D(a.lat, a.lon, a.alt, b.lat, b.lon, b.alt);
}

/**
 * 상태 -> key (문자열)
 */
function stateKey(s) {
  return `${s.lat},${s.lon},${s.alt}`;
}

/**
 * A* 경로 복원: cameFrom Map을 역추적
 */
function reconstructPath(cameFrom, current) {
  const path = [];
  let key = stateKey(current);

  // cameFrom에 남아있는 동안 계속 parent를 추적
  while (cameFrom.has(key)) {
    const [lat, lon, alt] = key.split(",").map(Number);
    path.unshift({ lat, lon, alt });
    key = cameFrom.get(key);
  }
  // 마지막 start도 추가
  const [slat, slon, salt] = key.split(",").map(Number);
  path.unshift({ lat: slat, lon: slon, alt: salt });

  return path;
}

/**
 * ============================
 * 5) Service 로직
 * ============================
 */

/**
 * Flight 테이블에 (id=사용자ID, originID, destinationID) 레코드 등록/갱신
 */
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

/**
 * 핵심 함수:
 * 1) 출발건물(originID), 도착건물(destinationID) → lat/lon 조회
 * 2) Obstacle 전부 조회
 * 3) 출발지/도착지 고도 설정 (예: 해당 건물 장애물 height + 20m)
 * 4) 26방향 3D A* 실행(stepDist=8.33, maxAlt=200)
 * 5) 경로 반환
 */
async function planSinglePathIgnoringOtherAircrafts(originID, destinationID) {
  console.log("[DBG] planSinglePathIgnoringOtherAircrafts() called");
  console.log("[DBG] originID =", originID, "destinationID =", destinationID);

  try {
    // 1) 장애물 가져오기
    const obstacles = await getAllObstacles();

    // 2) 출발/도착 건물
    const startBuilding = await getBuilding(originID);
    const endBuilding = await getBuilding(destinationID);
    if (!startBuilding || !endBuilding) {
      throw new Error("Invalid building ID(s)");
    }

    // 3) 출발/도착 건물 위치 기반 -> 해당 위치가 속한 장애물 찾기
    const startObstacle = obstacles.find((o) =>
      collideObstacle(startBuilding.lat, startBuilding.lon, 0, o)
    );
    const endObstacle = obstacles.find((o) =>
      collideObstacle(endBuilding.lat, endBuilding.lon, 0, o)
    );

    console.log("[DBG] startObstacle =", startObstacle);
    console.log("[DBG] endObstacle =", endObstacle);

    // 출발지 고도 = startObstacle.height + 20 (여유 공간)
    const startAlt = startObstacle? height + 20 : 100;
    const endAlt = endObstacle? height + 20 : 100;

    console.log(`[DBG] startAlt = ${startAlt}, endAlt = ${endAlt}`);

    // 4) A* 파라미터
    const stepDist = 8.33; // 1초당 최대 이동
    const maxAlt = 200; // 최대 고도(예시)

    // 시작/끝 상태
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

    // 5) 3D A* 탐색
    const path = await findPath3D(start, end, obstacles, maxAlt, stepDist);

    return path;
  } catch (error) {
    console.error("[ERR] planSinglePathIgnoringOtherAircrafts:", error);
    throw error;
  }
}

module.exports = {
  planSinglePathIgnoringOtherAircrafts,
  insertFlight,
};
