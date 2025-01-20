// src/Service/routeService.js
const pool = require("../mysql.js");
const { client } = require("../redis.js");

const routeService = {
  calculateCollisionFreeRoute,
  saveRouteToDB,
}
/**
 * 간단한 건물 충돌, 기존 비행체 충돌을 피하는 경로 계산 예시 (의사 코드)
 * 실제로는 3D 경로 탐색, A* 등 알고리즘이 필요합니다.
 */
async function calculateCollisionFreeRoute(user_id, start, end) {
  // 1) DB에서 건물(장애물) 정보를 불러오기
  //    예: 건물의 좌표(Polygon), 높이, 금지구역 등
  const buildings = await getBuildingsFromDB();

  // 2) Redis 또는 DB에서 현재까지의 '확정된' 다른 비행체들의 경로 정보 불러오기
  //    예: flightRoutes: [ { user_id, route: [ {lat, lng, alt}, ...] }, ...]
  const existingFlightRoutes = await getExistingFlightRoutes();

  // 3) start, end가 건물이나 금지구역 내부인지 체크
  //    필요하다면 예외 처리
  
  // 4) 나이브하게 "직선 경로" → 중간 샘플링 → 건물 충돌 또는 기존 경로와 충돌 검사
  //    충돌 시 우회 경로를 찾는 예시
  //    (여기서는 복잡도를 줄이기 위해서 단순히 '직선을 여러 번 시도'하거나
  //     '조금씩 높이(alt)를 변경'하는 식으로 충돌 회피하는 의사 코드)

  let route = generateSimpleRoute(start, end);

  let collision = checkCollision(route, buildings, existingFlightRoutes);
  if (collision) {
    // 충돌이 있으면 다른 우회 경로를 시도
    // 실제에선 경로 탐색 알고리즘(A*, RRT, etc.)을 구현해야 함
    route = generateAlternateRoute(start, end, buildings, existingFlightRoutes);
  }

  return route;
}

/**
 * 예시: DB에서 건물(장애물) 정보 가져오는 함수
 */
async function getBuildingsFromDB() {
  try {
    const [rows] = await pool.query("SELECT * FROM Building");
    // Building 테이블에 건물의 좌표, 높이, 등등이 있다고 가정
    return rows;
  } catch (error) {
    console.error("getBuildingsFromDB error:", error);
    return [];
  }
}

/**
 * 예시: Redis나 DB에서 이미 확정된 다른 비행체 경로를 가져옴
 * (여기서는 DB 테이블로 가정)
 */
async function getExistingFlightRoutes() {
  try {
    const [rows] = await pool.query("SELECT * FROM FlightRoute");
    // FlightRoute 테이블 구조 예시:
    // id, user_id, route(JSON), createdAt ...
    // route 컬럼 안에 [{lat, lng, alt}, {lat, lng, alt} ... ] 형태
    // 필요 시 JSON.parse 해서 반환
    return rows.map((r) => {
      return {
        user_id: r.user_id,
        route: JSON.parse(r.route), // 문자열 → 배열 변환
      };
    });
  } catch (error) {
    console.error("getExistingFlightRoutes error:", error);
    return [];
  }
}

/**
 * 단순 직선 보간 경로 생성
 */
function generateSimpleRoute(start, end) {
  const steps = 5;
  const latStep = (end.lat - start.lat) / steps;
  const lngStep = (end.lng - start.lng) / steps;

  const route = [];
  for (let i = 0; i <= steps; i++) {
    route.push({
      lat: start.lat + latStep * i,
      lng: start.lng + lngStep * i,
      alt: 50, // 예: 기본 50m 높이로 가정
    });
  }
  return route;
}

/**
 * 충돌 검사 예시
 * - buildings: 건물들의 좌표, 높이
 * - existingFlightRoutes: 다른 유저들의 경로
 */
function checkCollision(route, buildings, existingFlightRoutes) {
  // 1) 건물 충돌 여부
  for (const point of route) {
    if (isCollideWithBuilding(point, buildings)) {
      return true;
    }
  }

  // 2) 기존 비행체 경로 충돌 여부
  for (const flight of existingFlightRoutes) {
    if (isCollideWithRoute(route, flight.route)) {
      return true;
    }
  }

  return false;
}

/**
 * 실제 충돌 판정 로직(3D)은 훨씬 복잡합니다.
 * 여기서는 단순히 '건물 좌표 반경 안에 들어오면 충돌' 같은 의사 코드
 */
function isCollideWithBuilding(point, buildings) {
  // 예) 간단히 (lat, lng) 거리가 건물 중심(centroid)과 특정 반경 이하면 충돌
  //     alt가 건물 높이보다 낮으면 충돌
  return false; // 실제 구현 생략
}

function isCollideWithRoute(routeA, routeB) {
  // routeA, routeB를 각각 segment 단위로 돌면서 거리가 너무 가까우면 충돌
  // 예: 3D 거리 계산
  return false; // 실제 구현 생략
}

/**
 * 대체 경로 찾기(의사 코드)
 * - 단순히 alt를 10m 더 높이거나, lat/lng를 조금 수정해서 다시 직선 생성
 */
function generateAlternateRoute(start, end, buildings, existingFlightRoutes) {
  const route = generateSimpleRoute(
    { lat: start.lat, lng: start.lng, alt: 60 },
    { lat: end.lat, lng: end.lng, alt: 60 }
  );
  // 여기서 다시 충돌 검사 → 충돌 없으면 반환, 있으면 또 다른 방식 시도...
  return route;
}

/**
 * 경로를 DB에 저장(예시)
 */
async function saveRouteToDB(user_id, route) {
  try {
    const routeStr = JSON.stringify(route);
    const [result] = await pool.query(
      "INSERT INTO FlightRoute (user_id, route, createdAt) VALUES (?, ?, ?)",
      [user_id, routeStr, new Date()]
    );
    return result.insertId;
  } catch (error) {
    console.error("saveRouteToDB error:", error);
    return null;
  }
}

module.exports = routeService;
