// models/Service.js - MySQL-based model
import pool from "../config/mysql.js";

const Service = {
  async findAll() {
    const [rows] = await pool.query(
      "SELECT * FROM services ORDER BY createdAt DESC"
    );
    return rows;
  },

  async findById(id) {
    const [[row]] = await pool.query(
      "SELECT * FROM services WHERE id = ?",
      [id]
    );
    return row || null;
  },

  async create(data) {
    const {
      name,
      description = "",
      fee = 0,
      imageUrl = null,
      available = 1,
    } = data;
    const [result] = await pool.query(
      `INSERT INTO services (name, description, fee, imageUrl, available)
       VALUES (?, ?, ?, ?, ?)`,
      [name, description, fee, imageUrl, available ? 1 : 0]
    );
    return Service.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = ["name", "description", "fee", "imageUrl", "available"];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(
          key === "available" ? (data[key] ? 1 : 0) : data[key]
        );
      }
    }
    if (fields.length === 0) return Service.findById(id);
    values.push(id);
    await pool.query(
      `UPDATE services SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return Service.findById(id);
  },

  async delete(id) {
    await pool.query("DELETE FROM services WHERE id = ?", [id]);
  },
};

export default Service;
