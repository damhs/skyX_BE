// ./src/service/searchService.js
const pool = require('../mysql.js');
const uuid = require('uuid-sequential');

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
  postFavorite: async (userId, buildingId, favoriteName) => {
    try {
      const favoriteID = uuid();
      const updatedAt = new Date();
      await pool.query('INSERT INTO Favorite (favoriteID, buildingID, id, favoriteName, updatedAt) VALUES (?, ?, ?, ?, ?)', [favoriteID, buildingId, userId, favoriteName, updatedAt]);
    } catch (error) {
      console.error('postFavorite failed:', error);
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