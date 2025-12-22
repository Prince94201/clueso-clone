// Create MySQL connection pool using mysql2/promise
// Load credentials from environment variables
// Export pool and query helper function
// Add error handling and connection testing

const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function query(sql, params = []) {
  try {
    const bind = Array.isArray(params) ? params : [params];
    const [rows] = await pool.execute(sql, bind);
    return rows;
  } catch (err) {
    console.error('DB Query Error:', err.message);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw err;
  }
}

module.exports = { pool, query };