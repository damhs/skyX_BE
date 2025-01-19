// buildingService.js

const pool = require("../mysql.js"); // 또는 직접 mysql2/promise import
const { latLonToXY } = require("../Util/coordinate.js");
const { create3DGrid, worldToGrid, gridToWorld } = require("../Core/3dGrid.js");
const { markBuildingsAsObstacles } = require("../Core/obstacle.js");
const { setObstacleGrid } = require("../obstacleMap.js");

async function initBuildingObstacles() {
  try {
    // 1) MySQL에서 건물 정보 조회
    const [rows] = await pool.query("SELECT latitude, longitude, radius, height FROM Building");
    // rows = [{ lat:..., lon:..., radius:..., height:... }, ...]

    // 2) 3D Grid(또는 다른 자료구조) 생성
    //    여기서는 예시로 1km x 1km x 200m 범위를 3D Grid로 구성한다고 가정
    const minX = -500, maxX = 500;
    const minY = -500, maxY = 500;
    const minZ = 0,    maxZ = 200;
    const dx = 1, dy = 1, dz = 1;

    const gridInfo = create3DGrid(minX, maxX, minY, maxY, minZ, maxZ, dx, dy, dz);
    
    // 3) 건물 리스트(rows)를 가지고 장애물 표시
    //    기준점(lat0, lon0)는 예시로 중앙값 혹은 특정 지역 좌표
    const lat0 = 36.37317;
    const lon0 = 127.36062;

    // markBuildingsAsObstacles를 통해 gridInfo.grid를 업데이트
    markBuildingsAsObstacles(rows, gridInfo, lat0, lon0);

    // 4) obstacleMap.js(싱글톤)에 저장
    setObstacleGrid(gridInfo.grid, gridInfo);

    console.log(`Obstacle grid initialized. Building count: ${rows.length}`);
  } catch (error) {
    console.error("Failed to initialize building obstacles:", error);
    // 재시도나 프로세스 종료 등 에러 핸들링
  }
}

module.exports = {
  initBuildingObstacles
};
