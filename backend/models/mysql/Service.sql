-- Service table: stores structured service data in MySQL
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Semi-structured service data (instructions array, dates, slots map, specialNotes) is stored in MongoDB (ServiceMeta collection)
