// src/Router/showRouter.js
const express = require('express');
const showService = require('../Service/showService.js');
const showRouter = express.Router();

showRouter.get('/randomFlight', async (req, res) => {
  const result = await showService.getRandomFlight();
  res.json(result);
});

showRouter.get('/flight', async (req, res) => {
  const { user_id, originID, destinationID } = req.query;
  const result = await showService.getFlight(user_id, originID, destinationID);
  res.json(result);
});

showRouter.get('/position', async (req, res) => {
  const { user_id } = req.query;
  const result = await showService.getPosition(user_id);
  res.json(result);
});

showRouter.post('/position', async (req, res) => {
  const { user_id, latitude, longitude, altitude } = req.body;
  const result = await showService.postPosition(user_id, latitude, longitude, altitude);
  res.json(result);
});

module.exports = showRouter;