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

// // Building 테이블에서 원기둥(위도,경도,반경,높이) 데이터 조회
// async function getAllBuildings() {
//   const [rows] = await pool.query("SELECT * FROM Building");
//   return rows.map((b) => ({
//     buildingID: b.buildingID,
//     name: b.buildingName,
//     lat: Number(b.latitude),
//     lon: Number(b.longitude),
//     radius: Number(b.radius),
//     height: Number(b.height),
//   }));
// }


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