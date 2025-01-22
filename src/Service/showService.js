// src/Service/showService.js
const pool = require('../mysql.js');
const { client } = require('../redis.js');
const uuid = require('uuid-sequential');

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
        return allRoutes;
      } else {
        keys.sort(() => Math.random() - 0.5);
        const selected = keys.slice(0, 100); // 무작위 100개
        const allRoutes = [];
        for (const key of selected) {
          const r = await client.get(key);
          allRoutes.push(JSON.parse(r));
        }
        return allRoutes;
      }
    } catch (err) {
      console.error("Error fetching random routes:", err);
      res.status(500).send("Server Error");
    }
  },
  getFlight: async (id, originID, destinationID) => {
    try {
      const route = await client.get(`path:${originID}:${destinationID}`);
      const [rows] = await pool.query(
        "SELECT * FROM Flight WHERE id = ? AND originID = ? AND destinationID = ?",
        [id, originID, destinationID]
      );
      const updatedAt = new Date();
      if (rows.length > 0) {
        console.log("Flight record exists, updating updatedAt only");
        await pool.query(
          "UPDATE Flight SET updatedAt = ? WHERE id = ? AND originID = ? AND destinationID = ?",
          [updatedAt, id, originID, destinationID]
        );
      } else {
        console.log("Flight record not found, inserting new row");
        const flightID = uuid();
        await pool.query(
          "INSERT INTO Flight (flightID, id, originID, destinationID, updatedAt) VALUES (?, ?, ?, ?, ?)",
          [flightID, id, originID, destinationID, updatedAt]
        );
      }
      return JSON.parse(route);
    } catch (err) {
      console.error("Error fetching route:", err);
      res.status(500).send("Server Error");
    }
  }
};

module.exports = showService;