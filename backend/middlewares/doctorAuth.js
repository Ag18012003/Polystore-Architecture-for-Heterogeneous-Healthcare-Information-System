// backend/middleware/doctorAuth.js
import jwt from "jsonwebtoken";
import { pool } from "../config/mysql.js";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_here";

export default async function doctorAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  // 1. Check token
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Doctor not authorized, token missing",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    // 2. Verify token
    const payload = jwt.verify(token, JWT_SECRET);

    if (payload.role && payload.role !== "doctor") {
      return res.status(403).json({
        success: false,
        message: "Access denied (not a doctor)",
      });
    }

    // 3. Fetch doctor from MySQL
    const [rows] = await pool.query(
      "SELECT id, email, name, specialization, availability FROM doctors WHERE id = ?",
      [payload.id]
    );

    if (!rows.length) {
      return res.status(401).json({
        success: false,
        message: "Doctor not found",
      });
    }

    const row = rows[0];
    // 4. Attach doctor to request
    req.doctor = {
      id: row.id,
      _id: String(row.id),
      email: row.email,
      name: row.name,
      specialization: row.specialization,
      availability: row.availability,
    };

    next();
  } catch (err) {
    console.error("Doctor JWT verification failed:", err);
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }
}
