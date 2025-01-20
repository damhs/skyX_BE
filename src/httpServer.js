// httpServer.js
const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const authRouter = require("./Router/authRouter");

function initHttpServer() {
  const app = express();
  const port = 3001;

  // 미들웨어 설정
  app.use(cors());
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));

  // 라우터 설정
  app.use("/api/auth", authRouter);

  // 기본 경로
  app.get("/", (req, res) => {
    res.send("Hello World!");
  });

  // 서버 실행
  const server = app.listen(port, () => {
    console.log("Express server listening on port", port);
  });

  return server; // WebSocket 서버에 연결을 위해 서버 반환
}

module.exports = { initHttpServer };
