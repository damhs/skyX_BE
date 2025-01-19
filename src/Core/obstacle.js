// core/obstacle.js
const { worldToGrid } = require("./3dGrid");

function markBuildingsAsObstacles(buildings, gridInfo, lat0, lon0) {
  const { grid, sizeX, sizeY, sizeZ, minX, minY, minZ, dx, dy, dz } = gridInfo;
  
  buildings.forEach(building => {
    const { lat, lon, radius, height } = building;
    // 건물 중심 (x, y)
    const center = latLonToXY(lat, lon, lat0, lon0);
    
    // 건물의 고도 제한은 [0, height]라 가정 (지상부터?)
    // grid 내에서, center 근방을 뒤져서 원기둥 반경 안에 있는 지점 체크
    // (단, 실제 지면고도 반영이 필요한 경우는 별도 로직 필요)
    
    // 대략적 탐색 범위
    const minGridX = Math.max(0, Math.floor((center.x - radius - minX) / dx));
    const maxGridX = Math.min(sizeX - 1, Math.ceil((center.x + radius - minX) / dx));
    const minGridY = Math.max(0, Math.floor((center.y - radius - minY) / dy));
    const maxGridY = Math.min(sizeY - 1, Math.ceil((center.y + radius - minY) / dy));
    
    const maxGridZ = Math.min(sizeZ - 1, Math.ceil((height - minZ) / dz)); 
    // 건물 최대 높이 이하까지 장애물 표시
    
    for (let i = minGridX; i <= maxGridX; i++) {
      for (let j = minGridY; j <= maxGridY; j++) {
        for (let k = 0; k <= maxGridZ; k++) {
          // 현재 grid cell의 실제 좌표
          const x = minX + i * dx;
          const y = minY + j * dy;
          const z = minZ + k * dz; // z가 건물 높이 이하인지 체크
          
          // 원기둥 (x, y에서 center까지 거리 <= radius)이면 장애물
          const distXY = Math.sqrt((x - center.x)**2 + (y - center.y)**2);
          if (distXY <= radius && z >= 0 && z <= height) {
            grid[i][j][k] = 1;
          }
        }
      }
    }
  });
}

module.exports = { markBuildingsAsObstacles };
