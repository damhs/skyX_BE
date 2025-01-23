// src/Service/locationService.js
const pool = require('../mysql.js');

const locationService = {
  getLocation: async (user_id) => {
    try {
      const [rows] = await pool.query(
        "SELECT latitude, longitude, altitude FROM User WHERE id = ?",
        [user_id]
      );
      return rows[0];
    } catch (err) {
      console.error("Error fetching location:", err);
      res.status(500).send("Server Error");
    }
  },
  postLocation: async (user_id, lat, lon, alt) => {
    try {
      const [result] = await pool.query(
        "UPDATE User SET latitude = ?, longitude = ?, altitude = ? WHERE id = ?",
        [lat, lon, alt, user_id]
      );
      return result;
    } catch (err) {
      console.error("Error updating location:", err);
      res.status(500).send("Server Error");
    }
  }
};

module.exports = locationService;