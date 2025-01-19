// obstacleMap.js

// 장애물(건물) 정보를 반영한 3D Grid (혹은 다른 자료 구조)를 저장할 전역(싱글톤) 객체
let obstacleGrid = null;   // 예: 3D 그리드
let gridInfo = null;       // 격자 메타정보
let lastUpdated = null;    // 갱신 시간 등

function setObstacleGrid(newGrid, newGridInfo) {
  obstacleGrid = newGrid;
  gridInfo = newGridInfo;
  lastUpdated = new Date();
}

function getObstacleGrid() {
  return { obstacleGrid, gridInfo, lastUpdated };
}

module.exports = {
  setObstacleGrid,
  getObstacleGrid
};
