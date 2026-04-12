-- Doctor table: stores structured doctor data in MySQL
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Semi-structured doctor data (aboutSection, achievements, schedule, testimonials) is stored in MongoDB (DoctorMeta collection)
