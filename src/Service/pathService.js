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
    // altitude 컬럼이 없다면, lat/lon만
    lat: Number(b.latitude),
    lon: Number(b.longitude),
  };
  console.log("[DBG] Found building:", building);
  return building;
}

/**
 * ============================
 * 2) Haversine & 3D 거리 계산
 * ============================
 */

/**
 * (lat1, lon1)과 (lat2, lon2)의 2D(지표면) 거리(m) 계산
 * 구면(지구) 거리 → Haversine 공식
 */
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 평균 반지름(m)
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) *
    Math.cos(lat2 * toRad) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // meter
}

/**
 * (lat1, lon1, alt1)와 (lat2, lon2, alt2)의 3D 거리(m)
 *  => sqrt( (2D지표거리)^2 + (고도차)^2 )
 */
function distance3D(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dist2D = haversineDistance(lat1, lon1, lat2, lon2);
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
  const dist2D = haversineDistance(lat, lon, obstacle.lat, obstacle.lon);
  // alt가 obstacle.height 이하라면 충돌로 본다
  const collision = dist2D <= obstacle.radius && alt >= 0 && alt <= obstacle.height;

  if (collision) {
    console.log(
      `[DBG] Collision detected at lat:${lat}, lon:${lon}, alt:${alt} ` +
      `with obstacle lat:${obstacle.lat}, lon:${obstacle.lon}, h:${obstacle.height}`
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

        const costSoFar = gScore.get(currKey) || Infinity;
        const tentativeG = costSoFar + moveCost;
        const oldG = gScore.get(nbKey) || Infinity;

        // 더 나은 경로
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

  // lat, lon을 1초에 최대 8.33m 이동하려면?
  // 대략 latStep, lonStep를 작게 잡고, 실제 거리 <= 8.33m 조건으로 필터
  // 여기서는 lat/lon 한 칸(=0.00005도 ~=5.5m 근방) 사용할 수 있음
  // 그러나 26방향은 dx,dy,dz = -1,0,+1 조합
  // => latStep = 0.00005, lonStep = 0.00005, altStep=10
  //    이동 거리 ≤ 8.33m 이면 valid

  const latStep = 0.00005;
  const lonStep = 0.00005;
  const altStep = 10;

  // 3^3=27개 중 (0,0,0) 제외 → 26
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
    // 새 좌표
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
 *
 * planSinglePathIgnoringOtherAircrafts:
 *  - 출발/도착 buildingID → DB에서 lat,lon 조회
 *  - Obstacle 전부 조회
 *  - 출발지/도착지의 고도를 "건물 장애물의 height + 10" 등으로 설정(예시)
 *  - 3D A*로 경로 찾기
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
 * 2) Obstacle 테이블 조회 → 장애물들
 * 3) 출발지/도착지 고도 설정 (예: 해당 건물 장애물 height + 10m)
 * 4) 26방향 3D A* 실행(stepDist=8.33, maxAlt=200)
 * 5) 경로 반환 (1초 간격)
 */
async function planSinglePathIgnoringOtherAircrafts(originID, destinationID) {
  console.log("[DBG] planSinglePathIgnoringOtherAircrafts() called");
  console.log("[DBG] originID =", originID, "destinationID =", destinationID);

  // 1) 장애물 가져오기
  const obstacles = await getAllObstacles();

  // 2) 출발/도착 건물
  const startBuilding = await getBuilding(originID);
  const endBuilding = await getBuilding(destinationID);
  if (!startBuilding || !endBuilding) {
    throw new Error("Invalid building ID(s)");
  }

  // 3) 출발/도착 건물 위치 기반 -> 해당 위치가 속한 장애물 찾기
  //    (실제 로직은, lat/lon이 radius 범위 안에 있는 obstacle을 찾는 식이어야 함)
  //    여기서는 편의상 'find'나 'some' 같은 간단 충돌로 처리 예시
  const startObstacle = obstacles.find((o) =>
    collideObstacle(startBuilding.lat, startBuilding.lon, 0, o)
  );
  const endObstacle = obstacles.find((o) =>
    collideObstacle(endBuilding.lat, endBuilding.lon, 0, o)
  );

  // 출발지 고도 = startObstacle.height + 10 (간단 예시)
  const startAlt = startObstacle ? startObstacle.height + 10 : 50;
  const endAlt = endObstacle ? endObstacle.height + 10 : 50;

  // 4) A* 파라미터
  //    - 시속 30km/h => 8.33 m/s => 1초에 최대 8.33m 이동
  const stepDist = 8.33; // 1초당 최대 이동
  const maxAlt = 200;    // 최대 고도(예시)

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
  const path = findPath3D(start, end, obstacles, maxAlt, stepDist);

  // 도착 시점에 alt를 obstacle.height로 맞출 수도 있음
  // 여기서는 "도착점 alt를 그대로" 두거나, 
  //  path[path.length-1].alt = endObstacle.height? ... etc.

  return path;
}

module.exports = {
  planSinglePathIgnoringOtherAircrafts,
  insertFlight,
};
