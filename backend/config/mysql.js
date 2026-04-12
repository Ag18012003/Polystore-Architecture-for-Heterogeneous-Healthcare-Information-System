// config/mysql.js
import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "healthcare_db",
  port: parseInt(process.env.MYSQL_PORT || "3306", 10),
  waitForConnections: true,
  connectionLimit: parseInt(process.env.MYSQL_CONNECTION_LIMIT || "10", 10),
  queueLimit: 0,
  timezone: "+00:00",
});

export const connectMySQL = async () => {
  const conn = await pool.getConnection();
  console.log("MySQL connected");
  conn.release();
};

export const initMySQL = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id VARCHAR(36) PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        specialization VARCHAR(255) DEFAULT '',
        imageUrl TEXT DEFAULT NULL,
        imagePublicId VARCHAR(255) DEFAULT NULL,
        experience VARCHAR(255) DEFAULT '',
        qualifications TEXT DEFAULT '',
        location VARCHAR(255) DEFAULT '',
        fee DECIMAL(10,2) DEFAULT 0,
        availability ENUM('Available','Unavailable') DEFAULT 'Available',
        rating DECIMAL(3,2) DEFAULT 0,
        success VARCHAR(255) DEFAULT '',
        patients VARCHAR(255) DEFAULT '',
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_doctor_email (email)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        about TEXT DEFAULT '',
        shortDescription TEXT DEFAULT '',
        price DECIMAL(10,2) DEFAULT 0,
        available TINYINT(1) DEFAULT 1,
        imageUrl TEXT DEFAULT NULL,
        imagePublicId VARCHAR(255) DEFAULT NULL,
        totalAppointments INT DEFAULT 0,
        completed INT DEFAULT 0,
        canceled INT DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id VARCHAR(36) PRIMARY KEY,
        owner VARCHAR(255) NOT NULL,
        createdBy VARCHAR(255) DEFAULT NULL,
        patientName VARCHAR(255) NOT NULL,
        mobile VARCHAR(50) NOT NULL,
        age INT DEFAULT NULL,
        gender VARCHAR(50) DEFAULT '',
        doctorId VARCHAR(36) NOT NULL,
        doctorName VARCHAR(255) DEFAULT '',
        speciality VARCHAR(255) DEFAULT '',
        doctorImageUrl TEXT DEFAULT NULL,
        doctorImagePublicId VARCHAR(255) DEFAULT NULL,
        appointmentDate VARCHAR(20) NOT NULL,
        appointmentTime VARCHAR(50) NOT NULL,
        fees DECIMAL(10,2) DEFAULT 0,
        status ENUM('Pending','Confirmed','Completed','Canceled','Rescheduled') DEFAULT 'Pending',
        rescheduledDate VARCHAR(20) DEFAULT NULL,
        rescheduledTime VARCHAR(50) DEFAULT NULL,
        paymentMethod ENUM('Cash','Online') DEFAULT 'Cash',
        paymentStatus ENUM('Pending','Paid','Failed','Refunded') DEFAULT 'Pending',
        paymentAmount DECIMAL(10,2) DEFAULT 0,
        paymentProviderId VARCHAR(255) DEFAULT NULL,
        sessionId VARCHAR(255) DEFAULT NULL,
        paidAt DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_appt_doctor (doctorId),
        INDEX idx_appt_created_by (createdBy),
        INDEX idx_appt_session (sessionId),
        FOREIGN KEY (doctorId) REFERENCES doctors(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS service_appointments (
        id VARCHAR(36) PRIMARY KEY,
        createdBy VARCHAR(255) DEFAULT NULL,
        patientName VARCHAR(255) NOT NULL,
        mobile VARCHAR(50) NOT NULL,
        age INT DEFAULT NULL,
        gender VARCHAR(50) DEFAULT '',
        serviceId VARCHAR(36) NOT NULL,
        serviceName VARCHAR(255) NOT NULL,
        serviceImageUrl TEXT DEFAULT NULL,
        serviceImagePublicId VARCHAR(255) DEFAULT NULL,
        fees DECIMAL(10,2) NOT NULL,
        appointmentDate VARCHAR(20) NOT NULL,
        hour INT NOT NULL,
        minute INT NOT NULL,
        ampm ENUM('AM','PM') NOT NULL,
        status ENUM('Pending','Confirmed','Rescheduled','Completed','Canceled') DEFAULT 'Pending',
        rescheduledDate VARCHAR(20) DEFAULT NULL,
        rescheduledHour INT DEFAULT NULL,
        rescheduledMinute INT DEFAULT NULL,
        rescheduledAmpm ENUM('AM','PM') DEFAULT NULL,
        paymentMethod ENUM('Cash','Online') DEFAULT 'Cash',
        paymentStatus ENUM('Pending','Paid','Failed','Refunded','Canceled') DEFAULT 'Pending',
        paymentAmount DECIMAL(10,2) DEFAULT 0,
        paymentProviderId VARCHAR(255) DEFAULT NULL,
        paymentSessionId VARCHAR(255) DEFAULT NULL,
        paidAt DATETIME DEFAULT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_svcappt_service (serviceId),
        INDEX idx_svcappt_created_by (createdBy),
        INDEX idx_svcappt_session (paymentSessionId),
        FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    console.log("MySQL tables initialized");
  } finally {
    conn.release();
  }
};

export default pool;
