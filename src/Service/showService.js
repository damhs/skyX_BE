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
  },
  getPosition: async (id) => {
    try {
      const [rows] = await pool.query(
        "SELECT latitude, longitude, altitude FROM User WHERE id = ?", [id]
      );
      return rows[0];
    } catch (err) {
      console.error("Error fetching user position:", err);
      res.status(500).send("Server Error");
    }
  },
  postPosition: async (id, lat, lon, alt) => {
    try {
      const [result] = await pool.query(
        "UPDATE User SET latitude = ?, longitude = ?, altitude = ? WHERE id = ?", [lat, lon, alt, id]
      )
      return result;
    } catch (err) {
      console.error("Error updating user position:", err);
      res.status(500).send("Server Error");
    }
  },
  getPathWithBuildingName: async () => {
    try {
      const keys = await client.keys('path:*');
      const allRoutes = [];
      for (const key of keys) {
        const originID = key.split(':')[1];
        const destinationID = key.split(':')[2];
        const [origin] = await pool.query(
          "SELECT buildingName FROM Building WHERE buildingID = ?", [originID]
        );
        const [destination] = await pool.query(
          "SELECT buildingName FROM Building WHERE buildingID = ?", [destinationID]
        );
        const route = {
          originID,
          destinationID,
          origin: origin[0].buildingName,
          destination: destination[0].buildingName,
        };
        allRoutes.push(route);
      }
      return allRoutes;
    } catch (err) {
      console.error("Error fetching route:", err);
      res.status(500).send("Server Error");
    }
  }
};

module.exports = showService;