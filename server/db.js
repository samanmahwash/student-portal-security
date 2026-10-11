
const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "student_portal_security",
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

async function connectDB() {
  const connection = await pool.getConnection();

  try {
    await connection.ping();
    console.log("MySQL connected successfully!");
  } finally {
    connection.release();
  }
}

module.exports = { pool, connectDB };
