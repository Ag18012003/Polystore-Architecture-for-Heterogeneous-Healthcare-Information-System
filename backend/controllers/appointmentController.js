// controllers/appointmentController.js
// Polystore: structured data → MySQL (appointments table), semi-structured → MongoDB (AppointmentMeta)
import pool from "../config/mysql.js";
import AppointmentMeta from "../models/mongodb/AppointmentMeta.js";
import dotenv from "dotenv";
import { getAuth } from "@clerk/express";
import { clerkClient } from "@clerk/clerk-sdk-node";
import {
  newId,
  query,
  queryOne,
  insertRow,
  updateRow,
  mapAppointmentRow,
  toMySQLDatetime,
} from "../utils/queryHelpers.js";

dotenv.config();

const MAJOR_ADMIN_ID = process.env.MAJOR_ADMIN_ID || null;

const safeNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function resolveClerkUserId(req) {
  try {
    const auth = req.auth || {};
    const fromReq = auth?.userId || auth?.user_id || auth?.user?.id || req.user?.id || null;
    if (fromReq) return fromReq;
    try {
      const serverAuth = getAuth ? getAuth(req) : null;
      return serverAuth?.userId || null;
    } catch (e) {
      return null;
    }
  } catch (e) {
    return null;
  }
}

async function mergeWithMeta(row) {
  if (!row) return null;
  const base = mapAppointmentRow(row);
  const meta = await AppointmentMeta.findOne({ appointmentId: row.id }).lean();
  if (meta) {
    base.notes = meta.notes || "";
    base.specialRequirements = meta.specialRequirements || "";
    base.payment = { ...base.payment, meta: meta.paymentMeta || {} };
    base.auditLog = meta.auditLog || [];
  }
  return base;
}

async function mergeMany(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const metas = await AppointmentMeta.find({ appointmentId: { $in: ids } }).lean();
  const metaMap = {};
  metas.forEach((m) => { metaMap[m.appointmentId] = m; });

  return rows.map((row) => {
    const base = mapAppointmentRow(row);
    const meta = metaMap[row.id];
    if (meta) {
      base.notes = meta.notes || "";
      base.specialRequirements = meta.specialRequirements || "";
      base.payment = { ...base.payment, meta: meta.paymentMeta || {} };
      base.auditLog = meta.auditLog || [];
    }
    return base;
  });
}

/* ---------------- list / single / by-patient ---------------- */

export const getAppointments = async (req, res) => {
  try {
    const { doctorId, mobile, status, search = "", limit: limitRaw = 50, page: pageRaw = 1, patientClerkId, createdBy } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    if (doctorId) { conditions.push("doctorId = ?"); params.push(doctorId); }
    if (mobile) { conditions.push("mobile = ?"); params.push(mobile); }
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (patientClerkId) { conditions.push("createdBy = ?"); params.push(patientClerkId); }
    if (createdBy) { conditions.push("createdBy = ?"); params.push(createdBy); }
    if (search) {
      conditions.push("(patientName LIKE ? OR mobile LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(`SELECT * FROM appointments ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRes] = await pool.execute(`SELECT COUNT(*) AS total FROM appointments ${where}`, params);
    const total = countRes[0].total;

    const items = await mergeMany(rows);
    return res.json({ success: true, appointments: items, meta: { page, limit, total, count: items.length } });
  } catch (err) {
    console.error("getAppointments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Appointment not found" });
    const appt = await mergeWithMeta(row);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("getAppointmentById:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAppointmentsByPatient = async (req, res) => {
  try {
    const queryCreatedBy = req.query.createdBy || null;
    const clerkUserId = req.auth?.userId || null;
    const resolvedCreatedBy = queryCreatedBy || clerkUserId || null;

    if (!resolvedCreatedBy && !req.query.mobile) {
      return res.status(401).json({
        success: false,
        message: "Authentication required for /me",
      });
    }

    const conditions = [];
    const params = [];
    if (resolvedCreatedBy) { conditions.push("createdBy = ?"); params.push(resolvedCreatedBy); }
    if (req.query.mobile) { conditions.push("mobile = ?"); params.push(req.query.mobile); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(`SELECT * FROM appointments ${where} ORDER BY appointmentDate ASC, appointmentTime ASC`, params);
    const appointments = await mergeMany(rows);
    return res.json({ success: true, appointments });
  } catch (err) {
    console.error("Error in getAppointmentsByPatient:", err);
    return res.status(500).json({ success: false, message: "Server error while fetching appointments" });
  }
};

/* ---------------- create appointment ---------------- */

export const createAppointment = async (req, res) => {
  try {
    const {
      doctorId,
      patientName,
      mobile,
      age = "",
      gender = "",
      date,
      time,
      fee,
      fees,
      notes = "",
      paymentMethod,
      owner: ownerFromBody = null,
      doctorName: doctorNameFromBody,
      speciality: specialityFromBody,
      doctorImageUrl: doctorImageUrlFromBody,
      doctorImagePublicId: doctorImagePublicIdFromBody,
    } = req.body || {};

    const clerkUserId = resolveClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ success: false, message: "Authentication required (Clerk)" });

    if (!doctorId || !patientName || !mobile || !date || !time) {
      return res.status(400).json({ success: false, message: "doctorId, patientName, mobile, date and time are required" });
    }

    const numericFee = safeNumber(fee ?? fees ?? 0);
    if (numericFee === null || numericFee < 0) {
      return res.status(400).json({ success: false, message: "fee must be a valid number" });
    }

    // Duplicate booking prevention
    const existingBooking = await queryOne(
      "SELECT id FROM appointments WHERE doctorId = ? AND createdBy = ? AND appointmentDate = ? AND appointmentTime = ? AND status != 'Canceled'",
      [doctorId, clerkUserId, String(date), String(time)]
    );
    if (existingBooking) {
      return res.status(409).json({
        success: false,
        message: "You already have an appointment with this doctor at the selected date and time.",
      });
    }

    // Fetch doctor from MySQL
    const doctor = await queryOne("SELECT * FROM doctors WHERE id = ?", [doctorId]);
    if (!doctor) return res.status(404).json({ success: false, message: "Doctor not found" });

    let resolvedOwner = ownerFromBody || MAJOR_ADMIN_ID || doctorId;
    const doctorName = (doctor.name && String(doctor.name).trim()) || (doctorNameFromBody && String(doctorNameFromBody).trim()) || "";
    const speciality = (doctor.specialization && String(doctor.specialization).trim()) || (specialityFromBody && String(specialityFromBody).trim()) || "";
    const doctorImageUrl = (doctor.imageUrl && String(doctor.imageUrl).trim()) || (doctorImageUrlFromBody && String(doctorImageUrlFromBody).trim()) || "";
    const doctorImagePublicId = (doctor.imagePublicId && String(doctor.imagePublicId).trim()) || (doctorImagePublicIdFromBody && String(doctorImagePublicIdFromBody).trim()) || "";

    const id = newId();

    const method = paymentMethod === "Cash" ? "Cash" : "Online";
    const isFreePay = numericFee === 0;

    // Insert structured data into MySQL
    await insertRow("appointments", {
      id,
      owner: resolvedOwner,
      createdBy: clerkUserId,
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age ? Number(age) : null,
      gender: gender ? String(gender) : "",
      doctorId: String(doctorId),
      doctorName,
      speciality,
      doctorImageUrl,
      doctorImagePublicId,
      appointmentDate: String(date),
      appointmentTime: String(time),
      fees: numericFee,
      status: isFreePay ? "Confirmed" : "Pending",
      paymentMethod: method,
      paymentStatus: isFreePay ? "Paid" : "Pending",
      paymentAmount: numericFee,
      paidAt: isFreePay ? toMySQLDatetime(new Date()) : null,
    });

    // Insert semi-structured data into MongoDB
    await AppointmentMeta.create({
      appointmentId: id,
      notes: notes || "",
      paymentMeta: {},
    });

    const row = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(row);
    return res.status(201).json({ success: true, appointment: appt, checkoutUrl: null });
  } catch (err) {
    console.error("createAppointment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------- confirm payment (cash/manual) ---------------- */

export const confirmPayment = async (req, res) => {
  try {
    const { session_id, appointment_id } = req.query;
    const id = appointment_id || session_id;
    if (!id) return res.status(400).json({ success: false, message: "appointment_id or session_id is required" });

    // Try by id first, then by sessionId
    let row = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    if (!row) {
      row = await queryOne("SELECT * FROM appointments WHERE sessionId = ?", [id]);
    }
    if (!row) return res.status(404).json({ success: false, message: "Appointment not found" });

    if (row.paymentStatus !== "Paid") {
      await updateRow("appointments", row.id, {
        paymentStatus: "Paid",
        status: "Confirmed",
        paidAt: toMySQLDatetime(new Date()),
      });
    }

    const updated = await queryOne("SELECT * FROM appointments WHERE id = ?", [row.id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("confirmPayment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ---------------- update / cancel / stats / by-doctor / registered count ---------------- */

export const updateAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const row = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Appointment not found" });

    const terminal = row.status === "Completed" || row.status === "Canceled";
    if (terminal && body.status && body.status !== row.status) {
      return res.status(400).json({ success: false, message: "Cannot change status of a completed/canceled appointment" });
    }

    const mysqlUpdate = {};
    if (body.status) mysqlUpdate.status = body.status;

    if (body.date && body.time) {
      if (row.status === "Completed" || row.status === "Canceled") {
        return res.status(400).json({ success: false, message: "Cannot reschedule completed/canceled appointment" });
      }
      mysqlUpdate.appointmentDate = body.date;
      mysqlUpdate.appointmentTime = body.time;
      mysqlUpdate.status = "Rescheduled";
      mysqlUpdate.rescheduledDate = body.date;
      mysqlUpdate.rescheduledTime = body.time;
    }

    if (Object.keys(mysqlUpdate).length > 0) {
      await updateRow("appointments", id, mysqlUpdate);
    }

    // Update MongoDB meta for notes/audit
    if (body.notes !== undefined) {
      await AppointmentMeta.findOneAndUpdate(
        { appointmentId: id },
        { notes: body.notes },
        { upsert: true }
      );
    }

    const updated = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("updateAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT id FROM appointments WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Appointment not found" });

    await updateRow("appointments", id, { status: "Canceled" });
    const updated = await queryOne("SELECT * FROM appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("cancelAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getStats = async (req, res) => {
  try {
    const [totalRes] = await pool.execute("SELECT COUNT(*) AS total FROM appointments");
    const total = totalRes[0].total;

    const [revenueRes] = await pool.execute("SELECT COALESCE(SUM(fees),0) AS revenue FROM appointments WHERE paymentStatus = 'Paid'");
    const revenue = parseFloat(revenueRes[0].revenue) || 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [recentRes] = await pool.execute(
      "SELECT COUNT(*) AS recent FROM appointments WHERE createdAt >= ?",
      [toMySQLDatetime(sevenDaysAgo)]
    );
    const recent = recentRes[0].recent;

    return res.json({ success: true, stats: { total, revenue, recentLast7Days: recent } });
  } catch (err) {
    console.error("getStats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    if (!doctorId) return res.status(400).json({ success: false, message: "doctorId required" });

    const { mobile, status, search = "", limit: limitRaw = 50, page: pageRaw = 1 } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    const conditions = ["doctorId = ?"];
    const params = [doctorId];
    if (mobile) { conditions.push("mobile = ?"); params.push(mobile); }
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (search) {
      conditions.push("(patientName LIKE ? OR mobile LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = `WHERE ${conditions.join(" AND ")}`;
    const rows = await query(`SELECT * FROM appointments ${where} ORDER BY appointmentDate ASC, appointmentTime ASC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRes] = await pool.execute(`SELECT COUNT(*) AS total FROM appointments ${where}`, params);
    const total = countRes[0].total;

    const items = await mergeMany(rows);
    return res.json({ success: true, appointments: items, meta: { page, limit, total, count: items.length } });
  } catch (err) {
    console.error("getAppointmentsByDoctor:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function getRegisteredUserCount(req, res) {
  try {
    const totalUsers = await clerkClient.users.getCount();
    return res.json({ success: true, totalUsers });
  } catch (err) {
    console.error("getRegisteredUserCount error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export default {
  getAppointments,
  getAppointmentById,
  getAppointmentsByPatient,
  createAppointment,
  confirmPayment,
  updateAppointment,
  cancelAppointment,
  getStats,
  getAppointmentsByDoctor,
  getRegisteredUserCount,
};
