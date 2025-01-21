// src/Service/buildingService.js
const pool = require("../mysql.js");

const buildingService = {
  getBuildingLists: async () => {
    try {
      const [result] = await pool.query("SELECT * FROM Building");
      return result;
    } catch (error) {
      console.error("getBuildingLists failed:", error);
      throw error;
    }
  }
};

module.exports = buildingService;