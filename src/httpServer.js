// httpServer.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRouter = require("./Router/authRouter");
const buildingRouter = require("./Router/buildingRouter");
const searchRouter = require("./Router/searchRouter");
const routeRouter = require("./Router/routeRouter");
const pathRouter = require("./Router/pathRouter");
const cbsRouter = require("./Router/cbsRouter");

function initHttpServer() {
  const app = express();
  const port = 3001;

  // 미들웨어 설정
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // 라우터 설정
  app.use("/api/auth", authRouter);
  app.use("/api/building", buildingRouter);
  app.use("/api/search", searchRouter);

  // 새로 추가된 경로 라우터
  app.use("/api/route", routeRouter);
  app.use("/api/path", pathRouter);
  app.use("/api/cbs", cbsRouter);

  // 서버 실행
  const server = app.listen(port, () => {
    console.log("Express server listening on port", port);
  });

  return server; // WebSocket 서버에 연결을 위해 서버 반환
}

module.exports = { initHttpServer };
