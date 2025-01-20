// service/cbsService.js

const { getAllBuildings } = require("../mysql.js");

/** ============== Haversine + 고도 3D 거리 ============== */
/**
 * 지표면 2D거리: Haversine
 * (lat1, lon1), (lat2, lon2) -> meter
 */
function haversineDist(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // 지구 반경(m)
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat/2) ** 2 +
    Math.cos(lat1*toRad) * Math.cos(lat2*toRad) * Math.sin(dLon/2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

/** 
 * 3D 거리 = sqrt( (haversineDist)^2 + (altDiff)^2 )
 */
function distance3D(lat1, lon1, alt1, lat2, lon2, alt2) {
  const dist2D = haversineDist(lat1, lon1, lat2, lon2);
  const dAlt = alt2 - alt1;
  return Math.sqrt(dist2D*dist2D + dAlt*dAlt);
}

/** 
 * ============== 건물(원기둥) 충돌 체크 ============== 
 * point (lat, lon, alt)가 건물과 충돌?
 */
function collideWithBuilding(lat, lon, alt, building) {
  // 1) 수평 거리 = Haversine((lat,lon), (b.lat,b.lon))
  const dist2D = haversineDist(lat, lon, building.lat, building.lon);
  // 2) 반경 이내 && alt <= building.height
  if (dist2D <= building.radius && alt >= 0 && alt <= building.height) {
    return true;
  }
  return false;
}

/**
 * ============== 제약(Constraints) 체크 ==============
 * constraints: [{ agentID, lat, lon, alt, t }, ...]
 * => "agentID는 시각 t에 (lat, lon, alt)에 있으면 안된다"
 */
function violateConstraints(agentID, lat, lon, alt, t, constraints) {
  for (const c of constraints) {
    if (
      c.agentID === agentID &&
      c.t === t &&
      Math.abs(c.alt - alt) < 0.1 && // alt가 완전히 동일하다고 가정
      haversineDist(c.lat, c.lon, lat, lon) < 0.01 // lat/lon도 사실상 같음(격자)
    ) {
      return true;
    }
  }
  return false;
}

/** 
 * ============== Low-level Solver(단일 에이전트) ==============
 * 시공간 A* (lat, lon, alt, t)
 * - constraints: 현재 CBS 노드에서 주어진 "금지 시간좌표"
 * - buildings: 원기둥 장애물
 * - maxTime, speed, altStep 등 설정
 */
function findPathSingleAgent(agent, constraints, buildings) {
  const { start, end, maxAlt=100 } = agent;
  const MAX_TIME = 300;     // 최대 시뮬 시간
  const SPEED = 20;         // m/s (예: 20m/s = 72km/h)
  const ALT_STEP = 10;      // alt 이동 단위
  const TIME_STEP = 1;      // 1초 단위

  // openSet, cameFrom
  const openSet = [];
  const cameFrom = new Map(); // key: "lat,lon,alt,t"

  // gScore
  const gScore = new Map();

  // start state
  const startState = {
    lat: parseFloat(start.lat.toFixed(5)),
    lon: parseFloat(start.lon.toFixed(5)),
    alt: start.alt || 0,
    t: 0,
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
    // f값 가장 작은 state 꺼내기
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift();
    const currKey = stateKey(current);
    visited.add(currKey);

    // 도착 판정 (lat, lon, alt 모두 근접?)
    const distGoal = distance3D(
      current.lat, current.lon, current.alt,
      endState.lat, endState.lon, endState.alt
    );
    if (distGoal < 5) {
      // 성공. 경로 복원
      return reconstructPath(cameFrom, current);
    }

    if (current.t > MAX_TIME) continue;

    // 이웃 탐색
    const neighbors = getNeighbors(current, TIME_STEP, SPEED, ALT_STEP, maxAlt);
    for (const nb of neighbors) {
      // 1) 시간 증가
      nb.t = current.t + TIME_STEP;
      // 2) 건물 충돌 체크
      if (buildings.some((b) => collideWithBuilding(nb.lat, nb.lon, nb.alt, b))) {
        continue; // 충돌
      }
      // 3) 제약 체크
      if (violateConstraints(agent.id, nb.lat, nb.lon, nb.alt, nb.t, constraints)) {
        continue; // 위배
      }

      const nbKey = stateKey(nb);
      if (visited.has(nbKey)) continue;

      // 이동 거리
      const moveDist = distance3D(current.lat, current.lon, current.alt, nb.lat, nb.lon, nb.alt);
      const costSoFar = gScore.get(currKey) || Infinity;
      const tentativeG = costSoFar + moveDist;
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
  }

  // 실패
  return [];
}

/** 
 * 이웃 상태(시공간):
 * 일정 lat/lon 격자 단위로 '조금씩' 움직인다.
 * alt도 ALT_STEP만큼 위/아래/고정
 * - 실제론 격자 해상도에 따라 매우 많은 상태가 생길 수 있음
 */
function getNeighbors(state, dt, speed, altStep, maxAlt) {
  const moves = [];
  // lat/lon을 0.00005° 정도씩 움직인다고 가정 (약 5m 근방)
  // 실제론 더 정교한 방식 필요 (가변 그리드, etc.)
  const latStep = 0.00005;
  const lonStep = 0.00005;

  // 주변 8방 + alt up/down + 정지 등 선택
  // (실제로는 훨씬 많은 조합 가능)
  const deltas = [
    [ 0, 0 ], // 제자리
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

  // 고도 변화: -altStep, 0, +altStep
  const altMoves = [alt, alt+altStep, alt-altStep];

  for (const [dLat, dLon] of deltas) {
    for (const nextAlt of altMoves) {
      if (nextAlt < 0 || nextAlt > maxAlt) continue;
      // 이동 가능한 최대거리 = speed * dt
      // 이동 실제거리(지표면+alt)
      const dist3D = distance3D(lat, lon, alt, lat+dLat, lon+dLon, nextAlt);
      if (dist3D <= speed * dt) {
        // valid neighbor
        moves.push({
          lat: parseFloat((lat + dLat).toFixed(5)),
          lon: parseFloat((lon + dLon).toFixed(5)),
          alt: nextAlt,
        });
      }
    }
  }
  return moves;
}

/** 휴리스틱: 목표와의 3D 직선거리 */
function heuristic(a, b) {
  return distance3D(a.lat, a.lon, a.alt, b.lat, b.lon, b.alt);
}

/** 상태 → key */
function stateKey(s) {
  return `${s.lat},${s.lon},${s.alt},${s.t}`;
}

/** 경로 복원 */
function reconstructPath(cameFrom, current) {
  const path = [];
  let key = stateKey(current);

  while (cameFrom.has(key)) {
    const [lat, lon, alt, t] = key.split(",").map(Number);
    path.unshift({ lat, lon, alt, t });
    key = cameFrom.get(key);
  }
  // start도 추가
  const [slat, slon, salt, st] = key.split(",").map(Number);
  path.unshift({ lat: slat, lon: slon, alt: salt, t: st });

  return path;
}

/** 
 * ============== CBS (High-level) ==============
 * 1) 각 에이전트 Low-level search → 경로 세트
 * 2) 충돌 감지
 * 3) 충돌 있으면, 두 갈래 분기(제약 추가)
 * 4) 충돌 없어질 때까지 반복
 */
function detectConflict(paths) {
  // paths: { agentID, path: [{lat,lon,alt,t}, ...] }[]
  // 모든 쌍에 대해 충돌 있는지 체크
  for (let i = 0; i < paths.length; i++) {
    for (let j = i+1; j < paths.length; j++) {
      const pA = paths[i];
      const pB = paths[j];
      for (const sA of pA.path) {
        const sB = pB.path.find((s) => s.t === sA.t);
        if (!sB) continue;
        // 같은 시각 t에 3D 거리가 매우 가까우면 충돌
        const dist = distance3D(sA.lat, sA.lon, sA.alt, sB.lat, sB.lon, sB.alt);
        if (dist < 5) {
          return {
            agentA: pA.agentID,
            agentB: pB.agentID,
            t: sA.t,
            latA: sA.lat,
            lonA: sA.lon,
            altA: sA.alt,
            latB: sB.lat,
            lonB: sB.lon,
            altB: sB.alt,
          };
        }
      }
    }
  }
  return null; // no conflict
}

/**
 * CBS 본체 (간단 구현)
 * - agents: [{ id, start, end, ... }, ...]
 * - 반환: [{ agentID, path: [...]}]
 */
async function cbsPlan(agents) {
  // 1) 건물(장애물) 조회
  const buildings = await getAllBuildings();

  // 2) 초기 노드 생성 (constraints = [] 로 시작)
  const rootNode = {
    constraints: [], // 전체 에이전트에 대한 제약
    paths: [],       // { agentID, path: [...] }
  };

  // 모든 에이전트에 대해 low-level search
  const initialPaths = [];
  for (const ag of agents) {
    const path = findPathSingleAgent(ag, [], buildings);
    initialPaths.push({ agentID: ag.id, path });
  }
  rootNode.paths = initialPaths;

  // priority queue or 그냥 queue
  const open = [rootNode];

  while (open.length > 0) {
    const node = open.shift(); // FIFO
    // 1) 충돌 탐지
    const conflict = detectConflict(node.paths);
    if (!conflict) {
      // 충돌 없음 → 성공
      return node.paths;
    }
    // 2) 충돌 해결: agentA, agentB 중 하나에게 제약
    //    예: agentA가 시각 t에 (latA,lonA,altA)에 있지 못하도록
    //    그리고 별도로 agentB에게도 같은 방식 분기
    const newConstraintsA = {
      agentID: conflict.agentA,
      t: conflict.t,
      lat: conflict.latA,
      lon: conflict.lonA,
      alt: conflict.altA,
    };
    const newConstraintsB = {
      agentID: conflict.agentB,
      t: conflict.t,
      lat: conflict.latB,
      lon: conflict.lonB,
      alt: conflict.altB,
    };

    // 자식 노드 1
    const child1 = {
      constraints: [...node.constraints, newConstraintsA],
      paths: [...node.paths], // 복사
    };
    // child1에서 agentA 경로만 재계산
    {
      const agentA = agents.find((a) => a.id === conflict.agentA);
      const newPath = findPathSingleAgent(agentA, child1.constraints, buildings);
      child1.paths = child1.paths.map((p) =>
        p.agentID === conflict.agentA ? { agentID: p.agentID, path: newPath } : p
      );
    }

    // 자식 노드 2
    const child2 = {
      constraints: [...node.constraints, newConstraintsB],
      paths: [...node.paths], // 복사
    };
    {
      const agentB = agents.find((a) => a.id === conflict.agentB);
      const newPath = findPathSingleAgent(agentB, child2.constraints, buildings);
      child2.paths = child2.paths.map((p) =>
        p.agentID === conflict.agentB ? { agentID: p.agentID, path: newPath } : p
      );
    }

    // 두 자식 노드 큐에 삽입
    open.push(child1, child2);
  }

  // 실패
  return [];
}

/** 
 * 최종 export 함수
 * 입력: agents = [
 *   { id, start:{lat,lon,alt}, end:{lat,lon,alt}, maxAlt }, ...
 * ]
 * 출력: [{ agentID, path: [{lat,lon,alt,t}, ...]}, ...]
 */
async function planPathsCBS(agents) {
  const results = await cbsPlan(agents);
  return results;
}

module.exports = {
  planPathsCBS,
};
