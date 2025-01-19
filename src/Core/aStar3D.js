// core/aStar3D.js

class PriorityQueue {
  constructor() {
    this.items = [];
  }
  push(element, priority) {
    this.items.push({ element, priority });
    this.items.sort((a, b) => a.priority - b.priority);
  }
  pop() {
    return this.items.shift().element;
  }
  isEmpty() {
    return this.items.length === 0;
  }
}

function aStar3D(gridInfo, start, goal) {
  const { grid, sizeX, sizeY, sizeZ } = gridInfo;

  // 방향벡터(6방향)
  const directions = [
    [1, 0, 0], [-1, 0, 0],
    [0, 1, 0], [0, -1, 0],
    [0, 0, 1], [0, 0, -1],
  ];

  const key = (i, j, k) => `${i},${j},${k}`;

  const openSet = new PriorityQueue();
  const cameFrom = new Map(); // 경로 복원용
  const gScore = new Map();
  const fScore = new Map();

  const startKey = key(start.i, start.j, start.k);
  const goalKey = key(goal.i, goal.j, goal.k);

  // 휴리스틱 함수(유클리드 거리)
  function h(i, j, k) {
    const dx = goal.i - i;
    const dy = goal.j - j;
    const dz = goal.k - k;
    return Math.sqrt(dx*dx + dy*dy + dz*dz);
  }

  gScore.set(startKey, 0);
  fScore.set(startKey, h(start.i, start.j, start.k));
  openSet.push(start, fScore.get(startKey));

  while (!openSet.isEmpty()) {
    const current = openSet.pop();
    const currentKey = key(current.i, current.j, current.k);

    if (currentKey === goalKey) {
      // 경로 복원
      return reconstructPath(cameFrom, current);
    }

    for (const [di, dj, dk] of directions) {
      const ni = current.i + di;
      const nj = current.j + dj;
      const nk = current.k + dk;

      if (
        ni < 0 || ni >= sizeX ||
        nj < 0 || nj >= sizeY ||
        nk < 0 || nk >= sizeZ
      ) {
        continue; // 격자 범위 밖
      }
      if (grid[ni][nj][nk] === 1) {
        continue; // 장애물
      }

      const neighborKey = key(ni, nj, nk);
      const tentative_g = (gScore.get(currentKey) || Infinity) + 1;

      if (tentative_g < (gScore.get(neighborKey) || Infinity)) {
        cameFrom.set(neighborKey, current);
        gScore.set(neighborKey, tentative_g);
        fScore.set(neighborKey, tentative_g + h(ni, nj, nk));

        // openSet에 이미 들어있어도, 우선순위를 다시 조정해야 함
        // 여기서는 간단히 push 해버리고, pop 시점에 최소값이 유효
        openSet.push({ i: ni, j: nj, k: nk }, fScore.get(neighborKey));
      }
    }
  }

  return null; // 경로 없음
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let currentKey = `${current.i},${current.j},${current.k}`;

  while (cameFrom.has(currentKey)) {
    const prev = cameFrom.get(currentKey);
    path.push(prev);
    currentKey = `${prev.i},${prev.j},${prev.k}`;
  }
  return path.reverse();
}

module.exports = { aStar3D };
