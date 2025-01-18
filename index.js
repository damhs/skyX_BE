//index.js
const express = require("express");
const http = require("http");
const webSocketServer = require("websocket").server;
const pool = require('./src/mysql.js');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

const authRouter = require('./src/Router/authRouter.js');

dotenv.config();

const app = express();
const port = 3001;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/api/auth', authRouter);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

var server = http.createServer(app).listen(port, function () {
  console.log("Express server listening");
});

var wsServer = new webSocketServer({
  httpServer: server,
});

var eventHandler = {
  handleRequest: function (request) {
    console.log("Connection from origin " + request.origin + ".");
  },
  handleMessage: function (message) {
    console.log(JSON.stringify(message));
  },
  handleClose: function (connection) {
    console.log("disconnected.");
  },
};
wsServer.on("request", eventHandler.handleRequest);
