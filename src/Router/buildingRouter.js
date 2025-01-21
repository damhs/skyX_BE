// src/Router/buildingRouter.js
const express = require('express');
const buildingService = require('../Service/buildingService.js');
const buildingRouter = express.Router();

buildingRouter.get('/buildingList', async (req, res) => {
  const result = await buildingService.getBuildingLists();
  res.json(result);
});

module.exports = buildingRouter;