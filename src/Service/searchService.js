// src/service/searchService.js
const pool = require('../mysql.js');
const uuid = require('uuid-sequential');

const searchService = {
  favorite: async (userId) => {
    try {
      const [result] = await pool.query('SELECT * FROM Building WHERE buildingID IN (SELECT buildingID FROM Favorite WHERE id = ?)', [userId]);
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
      const [result] = await pool.query('SELECT * FROM Building WHERE buildingID IN (SELECT buildingID FROM Recent WHERE id = ? ORDER BY updatedAt DESC)', [userId]);
      return result;
    } catch (error) {
      console.error('recentBuilding failed:', error);
      throw error;
    }
  },
  postRecentBuilding: async (userId, buildingId) => {
    try {
      const updatedAt = new Date();
      const [result] = await pool.query('SELECT * FROM Recent WHERE id = ? AND buildingID = ?', [userId, buildingId]);
      if (result.length > 0) {
        await pool.query('UPDATE Recent SET updatedAt = ? WHERE id = ? AND buildingID = ?', [updatedAt, userId, buildingId]);
      }
      else {
        const recentID = uuid();
        await pool.query('INSERT INTO Recent (recentID, id, buildingID, updatedAt) VALUES (?, ?, ?, ?)', [recentID, userId, buildingId, updatedAt]);
      }
      return result;
    } catch (error) {
      console.error('postRecentBuilding failed:', error);
      throw error;
    }
  },
  recentFlight: async (userId) => {
    try {
      const query = `
        SELECT 
          Flight.flightID, 
          Flight.id, 
          Flight.originID, 
          Flight.destinationID, 
          Flight.updatedAt,
          originBuilding.buildingName AS originBuildingName,
          destinationBuilding.buildingName AS destinationBuildingName
        FROM 
          Flight
        LEFT JOIN 
          Building AS originBuilding 
          ON Flight.originID = originBuilding.buildingID
        LEFT JOIN 
          Building AS destinationBuilding 
          ON Flight.destinationID = destinationBuilding.buildingID
        WHERE 
          Flight.id = ?
        ORDER BY 
          Flight.updatedAt DESC
      `;
      const [result] = await pool.query(query, [userId]);
      return result;
    } catch (error) {
      console.error('recentFlight failed:', error);
      throw error;
    }
  }
};

module.exports = searchService;