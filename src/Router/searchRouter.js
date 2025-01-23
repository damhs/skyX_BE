// ./src/Router/searchRouter.js
const express = require('express');
const searchService = require('../Service/searchService.js');
const { search } = require('./authRouter.js');
const searchRouter = express.Router();

searchRouter.get('/favorite', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await searchService.favorite(userId);
  res.json(result);
});

searchRouter.post('/postFavorite', async (req, res) => {
  const userId = req.body.user_id;
  const buildingId = req.body.building_id;
  const favoriteName = req.body.favorite_name;
  if (!userId || !buildingId || !favoriteName) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  await searchService.postFavorite(userId, buildingId, favoriteName);
  res.json('success');
});

searchRouter.get('/recentBuilding', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await searchService.recentBuilding(userId);
  res.json(result);
});

searchRouter.post('/postRecentBuilding', async (req, res) => {
  const userId = req.body.user_id;
  const buildingId = req.body.building_id;
  if (!userId || !buildingId) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  await searchService.postRecentBuilding(userId, buildingId);
  res.json('success');
});

searchRouter.get('/recentFlight', async (req, res) => {
  const userId = req.query.user_id;
  if (!userId) {
    return res.status(400).json({ error: "Missing parameters" });
  }
  const result = await searchService.recentFlight(userId);
  res.json(result);
})

module.exports = searchRouter;