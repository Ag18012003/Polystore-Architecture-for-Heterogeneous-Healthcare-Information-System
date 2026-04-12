// models/Doctor.js - MySQL-based model
import pool from "../config/mysql.js";

const Doctor = {
  async findAll({ search = "", limit = 200, offset = 0 } = {}) {
    let sql = "SELECT * FROM doctors";
    const params = [];
    if (search) {
      sql += " WHERE name LIKE ? OR specialization LIKE ? OR email LIKE ?";
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    sql += " ORDER BY name ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);
    const [rows] = await pool.query(sql, params);
    return rows;
  },

  async countAll({ search = "" } = {}) {
    let sql = "SELECT COUNT(*) AS total FROM doctors";
    const params = [];
    if (search) {
      sql += " WHERE name LIKE ? OR specialization LIKE ? OR email LIKE ?";
      const like = `%${search}%`;
      params.push(like, like, like);
    }
    const [[row]] = await pool.query(sql, params);
    return row.total;
  },

  async findById(id) {
    const [[row]] = await pool.query("SELECT * FROM doctors WHERE id = ?", [id]);
    return row || null;
  },

  async findByEmail(email) {
    const [[row]] = await pool.query(
      "SELECT * FROM doctors WHERE email = ?",
      [email.toLowerCase()]
    );
    return row || null;
  },

  async create(data) {
    const {
      email,
      password,
      name,
      specialization = "",
      fee = 0,
      experience = "",
      qualifications = "",
      location = "",
      imageUrl = null,
      availability = "Available",
      about = "",
    } = data;
    const [result] = await pool.query(
      `INSERT INTO doctors
        (email, password, name, specialization, fee, experience, qualifications, location, imageUrl, availability, about)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email.toLowerCase(),
        password,
        name,
        specialization,
        fee,
        experience,
        qualifications,
        location,
        imageUrl,
        availability,
        about,
      ]
    );
    return Doctor.findById(result.insertId);
  },

  async update(id, data) {
    const allowed = [
      "name",
      "specialization",
      "fee",
      "experience",
      "qualifications",
      "location",
      "imageUrl",
      "availability",
      "about",
      "password",
      "email",
    ];
    const fields = [];
    const values = [];
    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key} = ?`);
        values.push(key === "email" ? data[key].toLowerCase() : data[key]);
      }
    }
    if (fields.length === 0) return Doctor.findById(id);
    values.push(id);
    await pool.query(
      `UPDATE doctors SET ${fields.join(", ")} WHERE id = ?`,
      values
    );
    return Doctor.findById(id);
  },

  async delete(id) {
    await pool.query("DELETE FROM doctors WHERE id = ?", [id]);
  },
};

export default Doctor;
