// core/3dGrid.js

function create3DGrid(minX, maxX, minY, maxY, minZ, maxZ, dx, dy, dz) {
  const sizeX = Math.ceil((maxX - minX) / dx) + 1;
  const sizeY = Math.ceil((maxY - minY) / dy) + 1;
  const sizeZ = Math.ceil((maxZ - minZ) / dz) + 1;

  // 3차원 배열(초기값 0)
  const grid = new Array(sizeX);
  for (let i = 0; i < sizeX; i++) {
    grid[i] = new Array(sizeY);
    for (let j = 0; j < sizeY; j++) {
      grid[i][j] = new Array(sizeZ).fill(0);
    }
  }

  return {
    grid,
    sizeX, sizeY, sizeZ,
    minX, minY, minZ,
    dx, dy, dz
  };
}

// grid_x, grid_y, grid_z -> 실제 좌표(x, y, z) 변환
function gridToWorld(i, j, k, gridInfo) {
  const { minX, minY, minZ, dx, dy, dz } = gridInfo;
  const x = minX + i * dx;
  const y = minY + j * dy;
  const z = minZ + k * dz;
  return { x, y, z };
}

// world 좌표 -> grid index
function worldToGrid(x, y, z, gridInfo) {
  const { minX, minY, minZ, dx, dy, dz } = gridInfo;
  const i = Math.round((x - minX) / dx);
  const j = Math.round((y - minY) / dy);
  const k = Math.round((z - minZ) / dz);
  return { i, j, k };
}

module.exports = { create3DGrid, gridToWorld, worldToGrid };
