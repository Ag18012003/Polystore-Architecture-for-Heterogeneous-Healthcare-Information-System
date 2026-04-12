import mysql from "mysql2/promise";

export const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "healthcare_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS doctors (
      id            INT AUTO_INCREMENT PRIMARY KEY,
      email         VARCHAR(255) NOT NULL UNIQUE,
      password      VARCHAR(255) NOT NULL,
      name          VARCHAR(255) NOT NULL,
      specialization VARCHAR(255) DEFAULT '',
      experience    VARCHAR(255) DEFAULT '',
      qualifications TEXT DEFAULT '',
      location      VARCHAR(255) DEFAULT '',
      about         TEXT DEFAULT '',
      fee           DECIMAL(10,2) DEFAULT 0,
      availability  ENUM('Available','Unavailable') DEFAULT 'Available',
      image_url     TEXT,
      image_public_id VARCHAR(255) DEFAULT NULL,
      schedule      JSON,
      success       VARCHAR(255) DEFAULT '',
      patients      VARCHAR(255) DEFAULT '',
      rating        DECIMAL(3,1) DEFAULT 0,
      created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id                 INT AUTO_INCREMENT PRIMARY KEY,
      name               VARCHAR(255) NOT NULL,
      about              TEXT DEFAULT '',
      short_description  TEXT DEFAULT '',
      price              DECIMAL(10,2) DEFAULT 0,
      available          TINYINT(1) DEFAULT 1,
      image_url          TEXT,
      image_public_id    VARCHAR(255) DEFAULT NULL,
      instructions       JSON,
      slots              JSON,
      total_appointments INT DEFAULT 0,
      completed          INT DEFAULT 0,
      canceled           INT DEFAULT 0,
      created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
  `);

  console.log("MySQL tables ready");
}

export async function connectMySQL() {
  const conn = await pool.getConnection();
  try {
    await conn.query("SELECT 1");
    console.log("MySQL connected");
  } finally {
    conn.release();
  }
  await initTables();
}
