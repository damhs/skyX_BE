// authService.js
const pool = require('../mysql.js');

const authService = {
  checkUser: async (id) => {
    try {
      const [result] = await pool.query('SELECT * FROM User WHERE id = ?', [id]);
      return result;
    } catch (error) {
      console.error('checkUser failed:', error);
      throw error; // Ensure the error is propagated
    }
  },

  signIn: async (id, nickname, profileURL) => {
    try {
      // Check if user already exists
      const existingUser = await authService.checkUser(id);
      
      if (existingUser.length > 0) {
        // User exists, return the existing user
        console.log('User already exists. Logging in:', existingUser[0]);
        return existingUser[0];
      }

      // If user doesn't exist, insert a new user
      const updatedAt = new Date();
      const [result] = await pool.query(
        'INSERT INTO User (id, nickname, profileURL, updatedAt) VALUES (?, ?, ?, ?)',
        [id, nickname, profileURL, updatedAt]
      );

      // Return the inserted user data
      console.log('New user signed in:', { id, nickname, profileURL, updatedAt });
      return { id, nickname, profileURL, updatedAt };
    } catch (error) {
      console.error('signIn failed:', error);
      throw error; // Ensure the error is propagated
    }
  }
};

module.exports = authService;
