// ./src/Router/searchRouter.js
const express = require('express');
const searchService = require('../Service/searchService.js');
const { search } = require('./authRouter.js');
const searchRouter = express.Router();

searchRouter.get('/favorite', async (req, res) => {
  const userId = req.query.userId;
  const result = await searchService.favorite(userId);
  res.json(result);
});

searchRouter.post('/postFavorite', async (req, res) => {
  const userId = req.body.user_id;
  const buildingId = req.body.building_id;
  const favoriteName = req.body.favorite_name;
  await searchService.postFavorite(userId, buildingId, favoriteName);
  res.json('success');
});

searchRouter.get('/recentPlace', async (req, res) => {
  const userId = req.query.userId;
  const result = await searchService.recentPlace(userId);
  res.json(result);
});

searchRouter.get('/recentRoute', async (req, res) => {
  const userId = req.query.userId;
  const result = await searchService.recentRoute(userId);
  res.json(result);
})

module.exports = searchRouter;