// src/Handler/routeHandler.js
const routeService = require("../Service/routeService.js");
const { broadcast, sendToUser } = require("../wsServer.js"); 
// wsServer에서 export 해놓은 메서드 사용 (예시)

async function handleRandomStartEnd(user_id, payload) {
  const { start, end } = payload;
  console.log(`[WS] handleRandomStartEnd from user:${user_id}`, start, end);

  // 경로 계산
  const route = await routeService.calculateCollisionFreeRoute(user_id, start, end);
  await routeService.saveRouteToDB(user_id, route);

  // 유니티(해당 user_id)에게 전송
  sendToUser(user_id, {
    type: "routeData",
    payload: { user_id, route },
  });
}

async function handleRequestRoute(user_id, payload) {
  const { start, end } = payload;
  console.log(`[WS] handleRequestRoute from user:${user_id}`, start, end);

  // 경로 계산
  const route = await routeService.calculateCollisionFreeRoute(user_id, start, end);
  await routeService.saveRouteToDB(user_id, route);

  // 본인에게
  sendToUser(user_id, {
    type: "routeData",
    payload: { user_id, route },
  });

  // Unity(시뮬)에도 브로드캐스트 (유저 비행체 생성)
  broadcast({
    type: "routeData",
    payload: { user_id, route },
  });
}

module.exports = {
  handleRandomStartEnd,
  handleRequestRoute,
};
