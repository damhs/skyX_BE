//index.js
const express = require("express");
const http = require("http");
const webSocketServer = require("websocket").server;
const pool = require('./src/mysql.js');
const cors = require('cors');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

dotenv.config();

const app = express();
const port = 3001;

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
