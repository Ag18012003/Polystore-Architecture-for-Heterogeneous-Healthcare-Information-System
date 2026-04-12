-- User table: stores Clerk user data in MySQL
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(255) PRIMARY KEY,  -- Clerk user ID
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) DEFAULT '',
  role ENUM('admin','doctor','patient') DEFAULT 'patient',
  createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
