// src/Router/showRouter.js
const express = require('express');
const showService = require('../Service/showService.js');
const showRouter = express.Router();

showRouter.get('/randomFlight', async (req, res) => {
  const result = await showService.getRandomFlight();
  res.json(result);
});

module.exports = showRouter;