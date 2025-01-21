// ./src/service/searchService.js
const pool = require('../mysql.js');

const searchService = {
  favorite: async (userId) => {
    try {
      const [result] = await pool.query('SELECT * FROM Building WHERE buildingID = (SELECT buildingID FROM Favorite WHERE id = ?)', [userId]);
      return result;
    } catch (error) {
      console.error('favorite failed:', error);
      throw error;
    }
  },
  recentBuilding: async (userId) => {
    try {
      const [result] = await pool.query('SELECT * FROM Building WHERE buildingID = (SELECT buildingID FROM Recent WHERE id = ?)', [userId]);
      return result;
    } catch (error) {
      console.error('recentBuilding failed:', error);
      throw error;
    }
  },
  recentFlight: async (userId) => {
    try {
      const [result] = await pool.query('SELECT * FROM Flight WHERE id = ?', [userId]);
      return result;
    } catch (error) {
      console.error('recentFlight failed:', error);
      throw error;
    }
  }
};

module.exports = searchService;