// src/Router/routeRouter.js
const express = require("express");
const routeService = require("../Service/routeService.js");
const routeRouter = express.Router();

/**
 * 8. Flutter(실사용자)에서 출발점/도착점 입력 후 BE로 전송
 *    [POST] /api/route/request
 *    body: { user_id, start: {lat, lng}, end: {lat, lng} }
 */
routeRouter.post("/request", async (req, res) => {
  try {
    const { user_id, start, end } = req.body;

    if (!user_id || !start || !end) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // 경로 계산 (Collision-Free)
    const route = await routeService.calculateCollisionFreeRoute(user_id, start, end);

    // 계산된 경로를 DB나 Redis에 저장하거나, 혹은 필요한 후속작업 수행
    // 예시로는 DB에 저장한다고 가정
    await routeService.saveRouteToDB(user_id, route);

    // FE(Flutter) 측 응답
    res.json({
      message: "Route calculated successfully",
      user_id,
      route,
    });

    // 이후 필요하다면 Unity나 다른 WebSocket 구독자에게도 브로드캐스트
    // (wsServer의 broadcast 함수를 직접 import하거나, Handler를 통해 호출)
    // 예: routeHandler.broadcastRoute(user_id, route);

  } catch (error) {
    console.error("requestRoute error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = routeRouter;
