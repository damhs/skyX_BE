// src/Router/showRouter.js
const express = require('express');
const showService = require('../Service/showService.js');
const showRouter = express.Router();

showRouter.get('/randomFlight', async (req, res) => {
  const result = await showService.getRandomFlight();
  res.json(result);
});

showRouter.get('/flightWithBuildingName', async (req, res) => {
  const { originName, destinationName } = req.query;
  if (!originName || !destinationName) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await showService.getFlightWithBuildingName(originName, destinationName);
  res.json(result);
});

showRouter.get('/flight', async (req, res) => {
  const { user_id, originID, destinationID } = req.query;
  if (!user_id || !originID || !destinationID) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await showService.getFlight(user_id, originID, destinationID);
  res.json(result);
});

showRouter.get('/position', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await showService.getPosition(user_id);
  res.json(result);
});

showRouter.post('/position', async (req, res) => {
  const { user_id, latitude, longitude, altitude } = req.body;
  const result = await showService.postPosition(user_id, latitude, longitude, altitude);
  res.json(result);
});

showRouter.get('/pathsWithBuildingName', async (req, res) => {
  const result = await showService.getPathsWithBuildingName();
  res.json(result);
});

module.exports = showRouter;