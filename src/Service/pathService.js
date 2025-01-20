// service/pathService.js
const { getAllBuildings } = require("../mysql.js");

/** 
 * 1) (lat, lon) <-> (x, y) 변환 (간단 평면 근사)
 *   - 실제론 Haversine/UTM 사용 권장
 */
const LAT_ORIGIN = 36.3725;
const LON_ORIGIN = 127.3608;

function latLonToXY(lat, lon) {
  const scale = 111319; // 약 1도 ~ 111,319m
  const x = (lon - LON_ORIGIN) * Math.cos(LAT_ORIGIN * Math.PI / 180) * scale;
  const y = (lat - LAT_ORIGIN) * scale;
  return { x, y };
}

function xyToLatLon(x, y) {
  const scale = 111319;
  const lat = y / scale + LAT_ORIGIN;
  const lon = x / (Math.cos(LAT_ORIGIN * Math.PI / 180) * scale) + LON_ORIGIN;
  return { lat, lon };
}

/** 
 * 2) 건물 충돌 판정 (원기둥)
 *    - point (x, y, z)
 *    - building: { lat, lon, radius, height }
 */
function collideWithBuilding(x, y, z, building) {
  const { x: bx, y: by } = latLonToXY(building.lat, building.lon);
  const dist2D = Math.sqrt((x - bx) ** 2 + (y - by) ** 2);
  if (dist2D <= building.radius && z >= 0 && z <= building.height) {
    return true;
  }
  return false;
}

/** 
 * 3) 이미 확정된 경로(시간 포함)와 충돌 판정
 *    - existingPaths: [
 *        [ {x, y, z, t}, {x, y, z, t}, ... ],  // 첫번째 에이전트 경로
 *        ...
 *      ]
 *    - "비행체 반경"이나 "안전거리"를 감안해서 dist <= SAFE_DIST 이면 충돌로 볼 수 있음
 *    - 시간까지 비교: t가 같을 때 가까우면 충돌
 */
function collideWithExistingPaths(x, y, z, t, existingPaths, safeDist = 10) {
  for (const path of existingPaths) {
    for (const p of path) {
      if (p.t === t) {
        const dx = x - p.x;
        const dy = y - p.y;
        const dz = z - p.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist <= safeDist) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 4) "시공간 A*" 구현 (4D: x,y,z,t)
 *    - 격자화된 4차원 공간을 탐색: 상태 = (x, y, z, t)
 *    - 다음 상태 = (x +/- step, y +/- step, z +/- step, t+1) 등
 *    - 장애물: 건물/기존 비행체 경로
 *    - 한 스텝(1초)에 이동할 수 있는 거리 제한 (예: 10m)
 */
function aStarTime4D(start3D, end3D, buildings, existingPaths) {
  // 설정
  const MAX_TIME = 300;      // 최대 300초까지 탐색 (데모용)
  const STEP_DIST = 10;      // 1초 동안 이동 가능 거리(10m)
  const Z_STEP = 10;         // 고도 이동 step
  const SAFE_DIST = 10;      // 비행체 간 안전 거리
  // 검색 범위
  const BOUNDS = {
    xMin: -300, xMax: 300,
    yMin: -300, yMax: 300,
    zMin: 0,    zMax: 200,
  };

  // A* 자료구조
  const openSet = [];
  const cameFrom = new Map();  // key: "x,y,z,t"
  const gScore = new Map();

  // 초기 상태
  const startState = {
    x: quantize(start3D.x),
    y: quantize(start3D.y),
    z: quantize(start3D.z),
    t: 0,
  };
  const endState = {
    x: quantize(end3D.x),
    y: quantize(end3D.y),
    z: quantize(end3D.z),
  };

  const startKey = stateKey(startState);
  gScore.set(startKey, 0);
  openSet.push({
    ...startState,
    f: heuristic4D(startState, endState),
  });

  const visited = new Set();

  while (openSet.length > 0) {
    // f값이 가장 작은 상태를 꺼냄
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currentKey = stateKey(current);

    // 목표 도달 판정 (z까지 정확히 맞출 필요가 있다면 아래 식)
    // 여기선 x,y만 도달하면 OK로 볼 수도 있지만,
    // 여기서는 z까지도 맞춘다고 가정.
    if (
      current.x === endState.x &&
      current.y === endState.y &&
      current.z === endState.z
    ) {
      // 경로 복원
      return reconstructPath(cameFrom, current);
    }

    visited.add(currentKey);

    // 시간 초과
    if (current.t > MAX_TIME) continue;

    // 이웃 상태들
    const neighbors = getNeighbors4D(current, STEP_DIST, Z_STEP, BOUNDS);
    for (const nb of neighbors) {
      // 장애물 체크(건물 + 기존 비행체)
      if (isObstacle4D(nb, buildings, existingPaths, SAFE_DIST)) {
        continue;
      }
      const nbKey = stateKey(nb);
      if (visited.has(nbKey)) continue;

      // gScore 계산
      const costSoFar = gScore.get(currentKey) || Infinity;
      const tentativeG = costSoFar + distance4D(current, nb);
      const oldG = gScore.get(nbKey) || Infinity;
      if (tentativeG < oldG) {
        cameFrom.set(nbKey, currentKey);
        gScore.set(nbKey, tentativeG);
        const fVal = tentativeG + heuristic4D(nb, endState);
        const foundIdx = openSet.findIndex((o) => stateKey(o) === nbKey);
        if (foundIdx >= 0) {
          openSet[foundIdx].f = fVal;
        } else {
          openSet.push({ ...nb, f: fVal });
        }
      }
    }
  }

  // 실패: 경로 없음
  return [];
}

/** 이웃 상태 생성: 1초 후 가능한 이동 (x±dist, y±dist, z±dist, t+1) */
function getNeighbors4D(state, stepDist, zStep, B) {
  const res = [];
  const { x, y, z, t } = state;

  // 3D 방향(6, 18, 26방 등 원하는 만큼) 여기선 7가지(멈춤 포함) 예시
  // 실사용에 맞게 늘리거나 줄이세요.
  const moves = [
    [0, 0, 0],          // 제자리 (속도=0)
    [ stepDist, 0, 0 ],
    [-stepDist, 0, 0 ],
    [0,  stepDist, 0 ],
    [0, -stepDist, 0 ],
    [0, 0,  zStep],
    [0, 0, -zStep],
  ];

  for (const [dx, dy, dz] of moves) {
    const nx = x + dx;
    const ny = y + dy;
    const nz = z + dz;
    const nt = t + 1;

    if (nx < B.xMin || nx > B.xMax) continue;
    if (ny < B.yMin || ny > B.yMax) continue;
    if (nz < B.zMin || nz > B.zMax) continue;
    // t는 일단 MAX_TIME 체크는 위에서
    res.push({ x: nx, y: ny, z: nz, t: nt });
  }
  return res;
}

/** 장애물 체크 (4D) */
function isObstacle4D(state, buildings, existingPaths, safeDist) {
  const { x, y, z, t } = state;
  // 건물 충돌
  for (const b of buildings) {
    if (collideWithBuilding(x, y, z, b)) {
      return true;
    }
  }
  // 다른 경로와 시간 충돌
  if (collideWithExistingPaths(x, y, z, t, existingPaths, safeDist)) {
    return true;
  }
  return false;
}

/** 4D 유클리드 거리(시간 축은 휴리스틱에 직접적으로 반영X, 또는 가중치) */
function distance4D(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

/** 휴리스틱(3D 거리) */
function heuristic4D(current, goal) {
  const dx = current.x - goal.x;
  const dy = current.y - goal.y;
  const dz = current.z - goal.z;
  return Math.sqrt(dx*dx + dy*dy + dz*dz);
}

/** 정수화 (격자화) */
function quantize(val, step = 10) {
  return Math.round(val / step) * step;
}

/** key for 4D */
function stateKey(s) {
  return `${s.x},${s.y},${s.z},${s.t}`;
}

/** 경로 복원 */
function reconstructPath(cameFrom, current) {
  const path = [];
  let key = stateKey(current);

  while (cameFrom.has(key)) {
    const [x, y, z, t] = key.split(",").map(Number);
    path.unshift({ x, y, z, t });
    key = cameFrom.get(key);
  }
  // start도 추가
  const [sx, sy, sz, st] = key.split(",").map(Number);
  path.unshift({ x: sx, y: sy, z: sz, t: st });

  return path;
}

/** 
 * 5) 다중 에이전트(순차) + 시간 고려
 *    - agents: [{agentID, start:{lat,lon,alt}, end:{lat,lon,alt}}, ...]
 *    - 각 에이전트마다 시공간 A* 실행
 *    - 이전 에이전트들의 경로(4D)를 'existingPaths'에 누적
 */
async function planMultiAgentPathsTime(agents) {
  // 1) 건물 정보 로드
  const buildings = await getAllBuildings();

  const results = [];
  // 모든 이전 에이전트 경로(4D)를 저장: [ [ {x,y,z,t}, ... ], ... ]
  const existingPaths = [];

  for (const ag of agents) {
    const { lat: slat, lon: slon, alt: salt=0 } = ag.start;
    const { lat: elat, lon: elon, alt: ealt=0 } = ag.end;
    const startXY = latLonToXY(slat, slon);
    const endXY   = latLonToXY(elat, elon);

    const start3D = { x: startXY.x, y: startXY.y, z: salt };
    const end3D   = { x: endXY.x,   y: endXY.y,   z: ealt };

    // A*
    const path4D = aStarTime4D(start3D, end3D, buildings, existingPaths);

    // 4D → lat,lon,alt + time
    const pathConverted = path4D.map((p) => {
      const { lat, lon } = xyToLatLon(p.x, p.y);
      return { lat, lon, alt: p.z, t: p.t };
    });

    // 결과 저장
    results.push({
      agentID: ag.agentID,
      path: pathConverted,
    });

    // 기존 경로 목록에 추가
    existingPaths.push(path4D);
  }

  return results;
}

module.exports = {
  planMultiAgentPathsTime,
};
