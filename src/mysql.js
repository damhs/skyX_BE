const mysql = require("mysql2/promise");
const dotenv = require("dotenv");

dotenv.config();

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
});

// MySQL 연결 테스트
const testConnection = async () => {
    try {
      const connection = await pool.getConnection();
      console.log('MySQL Database connected successfully');
      connection.release(); // 연결 해제
    } catch (error) {
      console.error('Database connection failed:', error);
    }
  };
  
testConnection(); // 서버 시작 시 연결 테스트

module.exports = pool;