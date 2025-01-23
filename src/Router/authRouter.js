// authRouter.js
const express = require('express');
const authService = require('../Service/authService.js');
const authRouter = express.Router();

authRouter.post('/signIn', async (req, res) => {
  const { id, nickname, profileURL } = req.body;
  if (!id || !nickname || !profileURL) {
    return res.status(400).json({ error: 'Missing parameters' });
  }
  const result = await authService.signIn(id, nickname, profileURL);
  res.json(result);
});

module.exports = authRouter;