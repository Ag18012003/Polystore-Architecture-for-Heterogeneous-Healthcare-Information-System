// utils/queryHelpers.js
// MySQL query builder helpers for the polystore architecture
import { randomUUID } from "crypto";
import pool from "../config/mysql.js";

/**
 * Generate a new UUID for use as MySQL primary key
 */
export const newId = () => randomUUID();

/**
 * Format a JS Date or string to MySQL DATETIME string "YYYY-MM-DD HH:MM:SS"
 */
export const toMySQLDatetime = (d) => {
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return null;
  return dt.toISOString().slice(0, 19).replace("T", " ");
};

/**
 * Execute a parameterized query and return all rows
 */
export const query = async (sql, params = []) => {
  const [rows] = await pool.execute(sql, params);
  return rows;
};

/**
 * Execute a parameterized query and return the first row or null
 */
export const queryOne = async (sql, params = []) => {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
};

/**
 * Insert a row into a table and return the inserted id
 * @param {string} table - Table name
 * @param {Object} data - Column-value pairs
 * @returns {string} - The id used for insertion
 */
export const insertRow = async (table, data) => {
  const id = data.id || newId();
  const row = { ...data, id };
  const cols = Object.keys(row).join(", ");
  const placeholders = Object.keys(row).map(() => "?").join(", ");
  const vals = Object.values(row);
  await pool.execute(`INSERT INTO \`${table}\` (${cols}) VALUES (${placeholders})`, vals);
  return id;
};

/**
 * Update a row in a table by id
 * @param {string} table - Table name
 * @param {string} id - Row id
 * @param {Object} data - Column-value pairs to update
 */
export const updateRow = async (table, id, data) => {
  if (!Object.keys(data).length) return;
  const sets = Object.keys(data).map((k) => `\`${k}\` = ?`).join(", ");
  const vals = [...Object.values(data), id];
  await pool.execute(`UPDATE \`${table}\` SET ${sets} WHERE id = ?`, vals);
};

/**
 * Delete a row from a table by id
 */
export const deleteRow = async (table, id) => {
  await pool.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);
};

/**
 * Build a WHERE clause from a filter object
 * Supports: string/number equality, arrays ($in), and date ranges ($gte, $ne)
 * Returns { clause: string, params: [] }
 */
export const buildWhere = (filter = {}) => {
  const conditions = [];
  const params = [];

  for (const [key, value] of Object.entries(filter)) {
    if (value === undefined || value === null) continue;

    if (typeof value === "object" && !Array.isArray(value)) {
      // Handle operators
      if (value.$ne !== undefined) {
        conditions.push(`\`${key}\` != ?`);
        params.push(value.$ne);
      }
      if (value.$in !== undefined && Array.isArray(value.$in)) {
        const placeholders = value.$in.map(() => "?").join(", ");
        conditions.push(`\`${key}\` IN (${placeholders})`);
        params.push(...value.$in);
      }
      if (value.$gte !== undefined) {
        conditions.push(`\`${key}\` >= ?`);
        params.push(value.$gte);
      }
      if (value.$lte !== undefined) {
        conditions.push(`\`${key}\` <= ?`);
        params.push(value.$lte);
      }
      if (value.$like !== undefined) {
        conditions.push(`\`${key}\` LIKE ?`);
        params.push(`%${value.$like}%`);
      }
    } else {
      conditions.push(`\`${key}\` = ?`);
      params.push(value);
    }
  }

  const clause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  return { clause, params };
};

/**
 * Map MySQL appointment row to the API response format expected by the frontend
 */
export const mapAppointmentRow = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    owner: row.owner,
    createdBy: row.createdBy,
    patientName: row.patientName,
    mobile: row.mobile,
    age: row.age,
    gender: row.gender,
    doctorId: row.doctorId,
    doctorName: row.doctorName,
    speciality: row.speciality,
    doctorImage: {
      url: row.doctorImageUrl || "",
      publicId: row.doctorImagePublicId || "",
    },
    date: row.appointmentDate,
    time: row.appointmentTime,
    fees: parseFloat(row.fees) || 0,
    status: row.status,
    rescheduledTo: row.rescheduledDate
      ? { date: row.rescheduledDate, time: row.rescheduledTime }
      : undefined,
    payment: {
      method: row.paymentMethod,
      status: row.paymentStatus,
      amount: parseFloat(row.paymentAmount) || 0,
      providerId: row.paymentProviderId || "",
      meta: {},
    },
    sessionId: row.sessionId,
    paidAt: row.paidAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Map MySQL doctor row to the API response format expected by the frontend
 */
export const mapDoctorRow = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    email: row.email,
    name: row.name,
    specialization: row.specialization || "",
    imageUrl: row.imageUrl || null,
    imagePublicId: row.imagePublicId || null,
    experience: row.experience || "",
    qualifications: row.qualifications || "",
    location: row.location || "",
    fee: parseFloat(row.fee) || 0,
    availability: row.availability || "Available",
    rating: parseFloat(row.rating) || 0,
    success: row.success || "",
    patients: row.patients || "",
    about: "",
    schedule: {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Map MySQL service row to the API response format expected by the frontend
 */
export const mapServiceRow = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    about: row.about || "",
    shortDescription: row.shortDescription || "",
    price: parseFloat(row.price) || 0,
    available: row.available === 1 || row.available === true,
    imageUrl: row.imageUrl || null,
    imagePublicId: row.imagePublicId || null,
    totalAppointments: row.totalAppointments || 0,
    completed: row.completed || 0,
    canceled: row.canceled || 0,
    instructions: [],
    dates: [],
    slots: {},
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};

/**
 * Map MySQL service_appointment row to the API response format
 */
export const mapServiceAppointmentRow = (row) => {
  if (!row) return null;
  return {
    _id: row.id,
    id: row.id,
    createdBy: row.createdBy,
    patientName: row.patientName,
    mobile: row.mobile,
    age: row.age,
    gender: row.gender,
    serviceId: row.serviceId,
    serviceName: row.serviceName,
    serviceImage: {
      url: row.serviceImageUrl || "",
      publicId: row.serviceImagePublicId || "",
    },
    fees: parseFloat(row.fees) || 0,
    date: row.appointmentDate,
    hour: row.hour,
    minute: row.minute,
    ampm: row.ampm,
    status: row.status,
    rescheduledTo: row.rescheduledDate
      ? {
          date: row.rescheduledDate,
          hour: row.rescheduledHour,
          minute: row.rescheduledMinute,
          ampm: row.rescheduledAmpm,
        }
      : undefined,
    payment: {
      method: row.paymentMethod,
      status: row.paymentStatus,
      amount: parseFloat(row.paymentAmount) || 0,
      providerId: row.paymentProviderId || "",
      sessionId: row.paymentSessionId || "",
      paidAt: row.paidAt,
      meta: {},
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
};
