// controllers/serviceAppointmentController.js
// Polystore: structured data → MySQL (service_appointments), semi-structured → MongoDB (ServiceAppointmentMeta)
import pool from "../config/mysql.js";
import ServiceAppointmentMeta from "../models/mongodb/ServiceAppointmentMeta.js";
import { getAuth } from "@clerk/express";
import {
  newId,
  query,
  queryOne,
  insertRow,
  updateRow,
  mapServiceAppointmentRow,
  toMySQLDatetime,
} from "../utils/queryHelpers.js";

const safeNumber = (val) => {
  if (val === undefined || val === null || val === "") return null;
  const n = Number(val);
  return Number.isFinite(n) ? n : null;
};

function parseTimeString(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const t = timeStr.trim();
  const m = t.match(/([0-9]{1,2}):?([0-9]{0,2})\s*(AM|PM|am|pm)?/);
  if (!m) return null;
  let hh = parseInt(m[1], 10);
  let mm = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = (m[3] || "").toUpperCase();
  if (Number.isNaN(hh) || Number.isNaN(mm)) return null;

  if (ampm) {
    if (hh < 1 || hh > 12 || mm < 0 || mm > 59) return null;
    return { hour: hh, minute: mm, ampm };
  }

  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  if (hh === 0) return { hour: 12, minute: mm, ampm: "AM" };
  if (hh === 12) return { hour: 12, minute: mm, ampm: "PM" };
  if (hh > 12) return { hour: hh - 12, minute: mm, ampm: "PM" };
  return { hour: hh, minute: mm, ampm: "AM" };
}

function resolveClerkUserId(req) {
  try {
    const auth = req.auth || {};
    const candidate = auth?.userId || auth?.user_id || auth?.user?.id || req.user?.id || null;
    if (candidate) return candidate;
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
  const base = mapServiceAppointmentRow(row);
  const meta = await ServiceAppointmentMeta.findOne({ appointmentId: row.id }).lean();
  if (meta) {
    base.notes = meta.notes || "";
    base.payment = { ...base.payment, meta: meta.paymentMeta || {} };
    base.auditLog = meta.auditLog || [];
  }
  return base;
}

async function mergeMany(rows) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const metas = await ServiceAppointmentMeta.find({ appointmentId: { $in: ids } }).lean();
  const metaMap = {};
  metas.forEach((m) => { metaMap[m.appointmentId] = m; });

  return rows.map((row) => {
    const base = mapServiceAppointmentRow(row);
    const meta = metaMap[row.id];
    if (meta) {
      base.notes = meta.notes || "";
      base.payment = { ...base.payment, meta: meta.paymentMeta || {} };
      base.auditLog = meta.auditLog || [];
    }
    return base;
  });
}

/* CREATE */
export const createServiceAppointment = async (req, res) => {
  try {
    const body = req.body || {};
    const clerkUserId = resolveClerkUserId(req);
    if (!clerkUserId) return res.status(401).json({ success: false, message: "Authentication required to create a service appointment." });

    const {
      serviceId,
      serviceName: serviceNameFromBody,
      patientName,
      mobile,
      age,
      gender,
      date,
      time,
      hour,
      minute,
      ampm,
      paymentMethod = "Cash",
      amount: amountFromBody,
      fees: feesFromBody,
      meta = {},
      notes = "",
      serviceImageUrl: serviceImageUrlFromBody,
      serviceImagePublicId: serviceImagePublicIdFromBody,
    } = body;

    if (!serviceId) return res.status(400).json({ success: false, message: "serviceId is required" });
    if (!patientName || !String(patientName).trim()) return res.status(400).json({ success: false, message: "patientName is required" });
    if (!mobile || !String(mobile).trim()) return res.status(400).json({ success: false, message: "mobile is required" });
    if (!date || !String(date).trim()) return res.status(400).json({ success: false, message: "date is required (YYYY-MM-DD)" });

    const numericAmount = safeNumber(amountFromBody ?? feesFromBody ?? 0);
    if (numericAmount === null || numericAmount < 0) return res.status(400).json({ success: false, message: "amount/fees must be a valid number" });

    let finalHour = hour !== undefined ? safeNumber(hour) : null;
    let finalMinute = minute !== undefined ? safeNumber(minute) : null;
    let finalAmpm = ampm || null;

    if (time && (finalHour === null || finalHour === undefined)) {
      const parsed = parseTimeString(time);
      if (!parsed) return res.status(400).json({ success: false, message: "time string couldn't be parsed" });
      finalHour = parsed.hour;
      finalMinute = parsed.minute;
      finalAmpm = parsed.ampm;
    }

    if (finalHour === null || finalMinute === null || (finalAmpm !== "AM" && finalAmpm !== "PM")) {
      return res.status(400).json({ success: false, message: "Time missing or invalid — provide time string or hour, minute and ampm." });
    }

    // DUPLICATE BOOKING CHECK
    const existing = await queryOne(
      "SELECT id FROM service_appointments WHERE serviceId = ? AND createdBy = ? AND appointmentDate = ? AND hour = ? AND minute = ? AND ampm = ? AND status != 'Canceled'",
      [String(serviceId), clerkUserId, String(date), Number(finalHour), Number(finalMinute), finalAmpm]
    );
    if (existing) return res.status(409).json({ success: false, message: "You already have a booking for this service at the selected date and time." });

    // Fetch service snapshot from MySQL
    const svc = await queryOne("SELECT * FROM services WHERE id = ?", [serviceId]);

    const resolvedServiceName = serviceNameFromBody || (svc && svc.name) || "Service";
    const finalServiceImageUrl = (svc && svc.imageUrl) || serviceImageUrlFromBody || "";
    const finalServiceImagePublicId = (svc && svc.imagePublicId) || serviceImagePublicIdFromBody || "";

    const id = newId();

    // Insert structured data into MySQL
    await insertRow("service_appointments", {
      id,
      createdBy: clerkUserId,
      patientName: String(patientName).trim(),
      mobile: String(mobile).trim(),
      age: age ? Number(age) : null,
      gender: gender || "",
      serviceId: String(serviceId),
      serviceName: resolvedServiceName,
      serviceImageUrl: finalServiceImageUrl,
      serviceImagePublicId: finalServiceImagePublicId,
      fees: numericAmount,
      appointmentDate: String(date),
      hour: Number(finalHour),
      minute: Number(finalMinute),
      ampm: finalAmpm,
      status: "Pending",
      paymentMethod: paymentMethod === "Cash" ? "Cash" : "Online",
      paymentStatus: numericAmount === 0 ? "Paid" : "Pending",
      paymentAmount: numericAmount,
      paidAt: numericAmount === 0 ? toMySQLDatetime(new Date()) : null,
    });

    // Insert semi-structured data into MongoDB
    await ServiceAppointmentMeta.create({
      appointmentId: id,
      notes: notes || "",
      paymentMeta: meta || {},
    });

    const row = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(row);
    return res.status(201).json({ success: true, appointment: appt, checkoutUrl: null });
  } catch (err) {
    console.error("createServiceAppointment unexpected:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* CONFIRM PAYMENT (manual/cash) */
export const confirmServicePayment = async (req, res) => {
  try {
    const { session_id, appointment_id } = req.query;
    const id = appointment_id || session_id;
    if (!id) return res.status(400).json({ success: false, message: "appointment_id or session_id is required" });

    let row = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    if (!row) {
      row = await queryOne("SELECT * FROM service_appointments WHERE paymentSessionId = ?", [id]);
    }
    if (!row) return res.status(404).json({ success: false, message: "Service appointment not found" });

    if (row.paymentStatus !== "Paid") {
      await updateRow("service_appointments", row.id, {
        paymentStatus: "Paid",
        status: "Confirmed",
        paidAt: toMySQLDatetime(new Date()),
      });
    }

    const updated = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [row.id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("confirmServicePayment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET list */
export const getServiceAppointments = async (req, res) => {
  try {
    const { serviceId, mobile, status, page: pageRaw = 1, limit: limitRaw = 50, search = "" } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    if (serviceId) { conditions.push("serviceId = ?"); params.push(serviceId); }
    if (mobile) { conditions.push("mobile = ?"); params.push(mobile); }
    if (status) { conditions.push("status = ?"); params.push(status); }
    if (search) {
      conditions.push("(patientName LIKE ? OR mobile LIKE ?)");
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(`SELECT * FROM service_appointments ${where} ORDER BY createdAt DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
    const [countRes] = await pool.execute(`SELECT COUNT(*) AS total FROM service_appointments ${where}`, params);
    const total = countRes[0].total;

    const appointments = await mergeMany(rows);
    return res.json({ success: true, appointments, meta: { page, limit, total, count: appointments.length } });
  } catch (err) {
    console.error("getServiceAppointments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET by id */
export const getServiceAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    const appt = await mergeWithMeta(row);
    return res.json({ success: true, data: appt });
  } catch (err) {
    console.error("getServiceAppointmentById:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* UPDATE */
export const updateServiceAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};

    const existing = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ success: false, message: "Not found" });

    const mysqlUpdate = {};
    if (body.status !== undefined) mysqlUpdate.status = body.status;
    if (body["payment.status"] !== undefined) mysqlUpdate.paymentStatus = body["payment.status"];

    if (body.payment !== undefined) {
      if (body.payment.method) mysqlUpdate.paymentMethod = body.payment.method;
      if (body.payment.status) {
        mysqlUpdate.paymentStatus = body.payment.status;
        if (body.payment.status === "Confirmed" || body.payment.status === "Paid") {
          mysqlUpdate.status = mysqlUpdate.status || "Confirmed";
          mysqlUpdate.paidAt = toMySQLDatetime(body.payment.paidAt || new Date());
        }
      }
      if (body.payment.providerId) mysqlUpdate.paymentProviderId = body.payment.providerId;
    }

    if (body.rescheduledTo) {
      const { date, time } = body.rescheduledTo || {};
      if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ success: false, message: "rescheduledTo.date must be YYYY-MM-DD" });
        mysqlUpdate.rescheduledDate = date;
        mysqlUpdate.appointmentDate = date;
      }
      if (time) {
        const parsed = parseTimeString(String(time));
        if (!parsed) return res.status(400).json({ success: false, message: "rescheduledTo.time couldn't be parsed" });
        mysqlUpdate.rescheduledHour = parsed.hour;
        mysqlUpdate.rescheduledMinute = parsed.minute;
        mysqlUpdate.rescheduledAmpm = parsed.ampm;
        mysqlUpdate.hour = parsed.hour;
        mysqlUpdate.minute = parsed.minute;
        mysqlUpdate.ampm = parsed.ampm;
      }
      if (!body.status) mysqlUpdate.status = "Rescheduled";
    }

    if (Object.keys(mysqlUpdate).length > 0) {
      await updateRow("service_appointments", id, mysqlUpdate);
    }

    // Update MongoDB meta for notes/payment meta
    const metaUpdate = {};
    if (body.notes !== undefined) metaUpdate.notes = body.notes;
    if (body.payment?.meta !== undefined) metaUpdate.paymentMeta = body.payment.meta;
    if (Object.keys(metaUpdate).length > 0) {
      await ServiceAppointmentMeta.findOneAndUpdate({ appointmentId: id }, metaUpdate, { upsert: true });
    }

    const updated = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, data: appt });
  } catch (err) {
    console.error("updateServiceAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* CANCEL */
export const cancelServiceAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Not found" });
    if (row.status === "Completed") return res.status(400).json({ success: false, message: "Cannot cancel a completed appointment" });

    const newPaymentStatus = row.paymentStatus === "Paid" ? "Refunded" : "Canceled";
    await updateRow("service_appointments", id, {
      status: "Canceled",
      paymentStatus: newPaymentStatus,
    });

    const updated = await queryOne("SELECT * FROM service_appointments WHERE id = ?", [id]);
    const appt = await mergeWithMeta(updated);
    return res.json({ success: true, data: appt });
  } catch (err) {
    console.error("cancelServiceAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* STATS */
export const getServiceAppointmentStats = async (req, res) => {
  try {
    const rows = await query(`
      SELECT s.id, s.name, s.price, s.imageUrl AS image,
        COUNT(sa.id) AS totalAppointments,
        SUM(CASE WHEN sa.status = 'Completed' THEN 1 ELSE 0 END) AS completed,
        SUM(CASE WHEN sa.status = 'Canceled' THEN 1 ELSE 0 END) AS canceled,
        SUM(CASE WHEN sa.status = 'Completed' THEN s.price ELSE 0 END) AS earning
      FROM services s
      LEFT JOIN service_appointments sa ON sa.serviceId = s.id
      GROUP BY s.id
      ORDER BY s.createdAt DESC
    `);

    return res.json({ success: true, services: rows, totalServices: rows.length });
  } catch (err) {
    console.error("getServiceAppointmentStats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* GET appointments for current patient (/me) */
export const getServiceAppointmentsByPatient = async (req, res) => {
  try {
    const clerkUserId = resolveClerkUserId(req);
    const { createdBy, mobile } = req.query;
    const resolvedCreatedBy = createdBy || clerkUserId || null;
    if (!resolvedCreatedBy && !mobile) return res.json({ success: true, data: [] });

    const conditions = [];
    const params = [];
    if (resolvedCreatedBy) { conditions.push("createdBy = ?"); params.push(resolvedCreatedBy); }
    if (mobile) { conditions.push("mobile = ?"); params.push(mobile); }

    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const rows = await query(`SELECT * FROM service_appointments ${where} ORDER BY createdAt DESC`, params);
    const list = await mergeMany(rows);
    return res.json({ success: true, data: list });
  } catch (err) {
    console.error("getServiceAppointmentsByPatient:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default {
  createServiceAppointment,
  confirmServicePayment,
  getServiceAppointments,
  getServiceAppointmentById,
  updateServiceAppointment,
  cancelServiceAppointment,
  getServiceAppointmentStats,
  getServiceAppointmentsByPatient,
};
