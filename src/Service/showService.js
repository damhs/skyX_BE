// src/Service/showService.js
const pool = require('../mysql.js');
const { client } = require('../redis.js');

const showService = {
  getRandomFlight: async () => {
    try {
      const keys = await client.keys('path:*');
      if (keys.length <= 100) {
        // 그냥 전부 반환
        const allRoutes = [];
        for (const key of keys) {
          const r = await client.get(key);
          allRoutes.push(JSON.parse(r));
        }
        return res.json(allRoutes);
      } else {
        keys.sort(() => Math.random() - 0.5);
        const selected = keys.slice(0, 100); // 무작위 100개
        const allRoutes = [];
        for (const key of selected) {
          const r = await client.get(key);
          allRoutes.push(JSON.parse(r));
        }
        return res.json(allRoutes);
      }
    } catch (err) {
      console.error("Error fetching random routes:", err);
      res.status(500).send("Server Error");
    }
  }
};

module.exports = showService;