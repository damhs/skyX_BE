// Service/pathService.js
const uuid = require("uuid-sequential");
const { getAllBuildings, pool } = require("../mysql.js");

// ------------------ Haversine + 고도 거리 ------------------
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 반경 (m)
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // meters
}

// 3D 거리 = sqrt( (수평거리)^2 + (고도차)^2 )
function distance3D(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dist2D = haversineDistance(lat1, lon1, lat2, lon2);
  const dAlt = alt2 - alt1;
  return Math.sqrt(dist2D*dist2D + dAlt*dAlt);
}

// ------------------ 건물 충돌 판정(원기둥) ------------------
function collideBuilding(lat, lon, alt, building) {
  const d2D = haversineDistance(lat, lon, building.lat, building.lon);
  if (d2D <= building.radius && alt >= 0 && alt <= building.height) {
    return true; // 충돌
  }
  return false;
}

// ------------------ 3D A* ------------------
/**
 * @param {Object} start - { lat, lon, alt }
 * @param {Object} end   - { lat, lon, alt }
 * @param {Array} buildings
 * @param {Number} maxAlt   최대 고도
 * @param {Number} stepDist 한 번에 이동할 수 있는 최대거리 (m)
 */
function findPath3D(start, end, buildings, maxAlt=200, stepDist=10) {
  // 1) A* 자료구조
  const openSet = [];
  const cameFrom = new Map(); // key: "lat,lon,alt"
  const gScore = new Map();

  // 2) 초기 상태
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

  while (openSet.length > 0) {
    // 2-1) f값이 가장 작은 state를 pop
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currKey = stateKey(current);
    visited.add(currKey);

    // 2-2) 도착 판정
    const distGoal = distance3D(
      current.lat, current.lon, current.alt,
      endState.lat, endState.lon, endState.alt
    );
    if (distGoal < 5) {
      // 5m 이내면 도착으로 간주
      return reconstructPath(cameFrom, current);
    }

    // 3) 이웃 생성
    const neighbors = getNeighbors(current, stepDist, maxAlt);
    for (const nb of neighbors) {
      const nbKey = stateKey(nb);
      if (visited.has(nbKey)) continue;

      // 3-1) 건물 충돌 체크
      const collision = buildings.some((b) => collideBuilding(nb.lat, nb.lon, nb.alt, b));
      if (collision) {
        continue; 
      }

      // 3-2) 이동 비용
      const moveCost = distance3D(
        current.lat, current.lon, current.alt,
        nb.lat, nb.lon, nb.alt
      );
      const costSoFar = gScore.get(currKey) || Infinity;
      const tentativeG = costSoFar + moveCost;
      const oldG = gScore.get(nbKey) || Infinity;

      if (tentativeG < oldG) {
        cameFrom.set(nbKey, currKey);
        gScore.set(nbKey, tentativeG);
        const fVal = tentativeG + heuristic(nb, endState);

        const foundIdx = openSet.findIndex((o) => stateKey(o) === nbKey);
        if (foundIdx >= 0) {
          openSet[foundIdx].f = fVal;
        } else {
          openSet.push({ ...nb, f: fVal });
        }
      }
    }
  }

  // 경로 없음
  return [];
}

/**
 * 이웃 상태 생성:
 * - 수평으로 ±deltaLat, ±deltaLon, 대각선 등
 * - 고도 ± altStep
 * - 실제 거리로 8~10m 정도가 1스텝
 *   (30km/h=8.33m/s, 1초당 8~10m 이동 가능이라고 보면 됨)
 * - 여기선 간단히 lat, lon을 0.00005° (~5m)씩 움직이고,
 *   alt는 10m씩 움직이게 하겠습니다.
 */
function getNeighbors(state, stepDist, maxAlt) {
  const latStep = 0.00005; // 약 5m
  const lonStep = 0.00005;
  const altStep = 10;

  // 기본 이동 후보 (8방향 + 정지)
  const deltas = [
    [ 0, 0 ],
    [ latStep, 0 ],
    [-latStep, 0 ],
    [ 0, lonStep ],
    [ 0,-lonStep ],
    [ latStep, lonStep ],
    [ latStep,-lonStep ],
    [-latStep, lonStep ],
    [-latStep,-lonStep ],
  ];

  const { lat, lon, alt } = state;
  const neighbors = [];

  for (const [dLat, dLon] of deltas) {
    // 고도는 alt ± altStep, alt 그대로
    for (const dAlt of [0, altStep, -altStep]) {
      const nextAlt = alt + dAlt;
      if (nextAlt < 0 || nextAlt > maxAlt) {
        continue;
      }

      // 새 좌표
      const newLat = parseFloat((lat + dLat).toFixed(5));
      const newLon = parseFloat((lon + dLon).toFixed(5));
      
      // 실제 3D 이동 거리가 stepDist=10m 이하인지 확인?
      // 여기서는 "최대 이동 거리"를 기준으로 필터링할 수도 있음
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

/** 휴리스틱: 목표까지의 3D 직선거리 */
function heuristic(a, b) {
  return distance3D(a.lat, a.lon, a.alt, b.lat, b.lon, b.alt);
}

/** 상태 -> key */
function stateKey(s) {
  return `${s.lat},${s.lon},${s.alt}`;
}

/** 경로 복원 */
function reconstructPath(cameFrom, current) {
  const path = [];
  let key = stateKey(current);

  while (cameFrom.has(key)) {
    const [lat, lon, alt] = key.split(",").map(Number);
    path.unshift({ lat, lon, alt });
    key = cameFrom.get(key);
  }
  // start도 추가
  const [slat, slon, salt] = key.split(",").map(Number);
  path.unshift({ lat: slat, lon: slon, alt: salt });

  return path;
}

/**
 * 외부에 제공할 함수:
 * @param {Object} start { lat, lon, alt }
 * @param {Object} end   { lat, lon, alt }
 * @returns [{ lat, lon, alt }, ...] 경로
 */
async function planSinglePathIgnoringOtherAgents(start, end) {
  // 1) DB에서 건물 정보 로드
  const buildings = await getAllBuildings();

  // 2) 최대 이동 가능 거리(1스텝) 설정
  //  30km/h = 8.33m/s => "1초당 8~10m" 이동 가능.
  //  여기서는 10m로 두겠습니다.
  const stepDist = 10;

  // 3) 최대 고도 (예: 200m)
  const maxAlt = 200;

  // 4) A* 탐색
  const path = findPath3D(start, end, buildings, maxAlt, stepDist);
  return path;
}

async function insertFlight(id, start, end) {
  const flightID = uuid();
  const originID = await pool.query(
    'SELECT buildingID FROM Building WHERE latitude = ? AND longitude = ?',
    [start.lat, start.lon]
  )
  const destinationID = await pool.query(
    'SELECT buildingID FROM Building WHERE latitude = ? AND longitude = ?',
    [end.lat, end.lon]
  )
  const updatedAt = new Date();
  const [result] = await pool.query(
    'INSERT INTO Flight (flightID, id, originID, destinationID, updatedAt) VALUES (?, ?, ?, ?, ?)',
    [flightID, id, originID, destinationID, updatedAt]
  );
  return { flightID, id, originID, destinationID, updatedAt };
}

module.exports = {
  planSinglePathIgnoringOtherAgents,
  insertFlight,
};