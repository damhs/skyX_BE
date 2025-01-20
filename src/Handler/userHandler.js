// userHandler.js
const pool = require("../mysql");

// 사용자 확인 함수
async function validateUser(user_id) {
  const [rows] = await pool.query("SELECT * FROM User WHERE id = ?", [user_id]);
  return rows.length > 0;
}

module.exports = { validateUser };
