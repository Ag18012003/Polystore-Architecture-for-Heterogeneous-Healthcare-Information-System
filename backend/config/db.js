import mongoose from "mongoose";
import pool from "./mysql.js";

export const connectMongoDB = async () => {
  const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/healthcare";
  await mongoose.connect(uri);
  console.log("MongoDB connected:", uri);
};

export const connectMySQL = async () => {
  const conn = await pool.getConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS doctors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        email VARCHAR(255) NOT NULL UNIQUE,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        specialization VARCHAR(255) DEFAULT '',
        fee DECIMAL(10,2) DEFAULT 0,
        experience VARCHAR(255) DEFAULT '',
        qualifications TEXT,
        location VARCHAR(255) DEFAULT '',
        imageUrl TEXT,
        availability VARCHAR(50) DEFAULT 'Available',
        about TEXT,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    await conn.query(`
      CREATE TABLE IF NOT EXISTS services (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        fee DECIMAL(10,2) DEFAULT 0,
        imageUrl TEXT,
        available TINYINT(1) DEFAULT 1,
        createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    console.log("MySQL connected and tables initialized");
  } finally {
    conn.release();
  }
};

export const connectDB = async () => {
  await Promise.all([connectMongoDB(), connectMySQL()]);
};
