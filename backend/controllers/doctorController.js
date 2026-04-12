// controllers/doctorController.js
// Polystore: structured data → MySQL, semi-structured data → MongoDB (DoctorMeta)
import jwt from "jsonwebtoken";
import pool from "../config/mysql.js";
import DoctorMeta from "../models/mongodb/DoctorMeta.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import {
  newId,
  query,
  queryOne,
  insertRow,
  updateRow,
  deleteRow,
  mapDoctorRow,
} from "../utils/queryHelpers.js";

/* ---------------- Helpers ---------------- */

function parseScheduleInput(s) {
  if (!s) return {};
  if (typeof s === "string") {
    try { s = JSON.parse(s); } catch { return {}; }
  }
  if (typeof s !== "object" || Array.isArray(s)) return {};
  const out = {};
  Object.entries(s).forEach(([date, slots]) => {
    if (!Array.isArray(slots)) return;
    out[date] = Array.from(new Set(slots));
  });
  return out;
}

function mergeDoctorWithMeta(row, meta) {
  const base = mapDoctorRow(row);
  if (!base) return null;
  if (meta) {
    base.about = meta.aboutSection || "";
    base.schedule = meta.schedule || {};
    base.achievements = meta.achievements || [];
    base.articleRefs = meta.articleRefs || [];
    base.testimonials = meta.testimonials || [];
  }
  return base;
}

/* ---------------- Controllers ---------------- */

export async function createDoctor(req, res) {
  try {
    const body = req.body || {};
    if (!body.email || !body.password || !body.name) {
      return res.status(400).json({ success: false, message: "email, password and name are required" });
    }

    const emailLC = body.email.toLowerCase();
    const existing = await queryOne("SELECT id FROM doctors WHERE email = ?", [emailLC]);
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }

    let imageUrl = body.imageUrl || null;
    let imagePublicId = body.imagePublicId || null;
    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, "doctors");
      imageUrl = uploaded?.secure_url || uploaded?.url || imageUrl;
      imagePublicId = uploaded?.public_id || uploaded?.publicId || imagePublicId;
    }

    const id = newId();

    // Insert structured fields into MySQL
    await insertRow("doctors", {
      id,
      email: emailLC,
      password: body.password,
      name: body.name,
      specialization: body.specialization || "",
      imageUrl: imageUrl || null,
      imagePublicId: imagePublicId || null,
      experience: body.experience || "",
      qualifications: body.qualifications || "",
      location: body.location || "",
      fee: body.fee !== undefined ? Number(body.fee) : 0,
      availability: body.availability || "Available",
      rating: body.rating !== undefined ? Number(body.rating) : 0,
      success: body.success || "",
      patients: body.patients || "",
    });

    // Insert semi-structured fields into MongoDB
    const schedule = parseScheduleInput(body.schedule);
    await DoctorMeta.create({
      doctorId: id,
      aboutSection: body.about || "",
      achievements: [],
      articleRefs: [],
      testimonials: [],
      schedule,
    });

    const row = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    const meta = await DoctorMeta.findOne({ doctorId: id }).lean();
    const out = mergeDoctorWithMeta(row, meta);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }
    const token = jwt.sign({ id, email: emailLC, role: "doctor" }, secret, { expiresIn: "7d" });

    return res.status(201).json({ success: true, data: out, token });
  } catch (err) {
    console.error("createDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export const getDoctors = async (req, res) => {
  try {
    const { q = "", limit: limitRaw = 200, page: pageRaw = 1 } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 200));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    let whereSql = "";
    const params = [];
    if (q && q.trim()) {
      whereSql = "WHERE (d.name LIKE ? OR d.specialization LIKE ? OR d.email LIKE ?)";
      params.push(`%${q.trim()}%`, `%${q.trim()}%`, `%${q.trim()}%`);
    }

    const rows = await query(
      `SELECT d.*,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctorId = d.id) AS appointmentsTotal,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctorId = d.id AND a.status IN ('Confirmed','Completed')) AS appointmentsCompleted,
        (SELECT COUNT(*) FROM appointments a WHERE a.doctorId = d.id AND a.status = 'Canceled') AS appointmentsCanceled,
        (SELECT COALESCE(SUM(a.fees),0) FROM appointments a WHERE a.doctorId = d.id AND a.status IN ('Confirmed','Completed')) AS earnings
       FROM doctors d ${whereSql} ORDER BY d.name LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) AS total FROM doctors ${whereSql}`,
      params
    );
    const total = countResult[0].total;

    // Fetch all meta in one MongoDB query
    const ids = rows.map((r) => r.id);
    const metas = ids.length
      ? await DoctorMeta.find({ doctorId: { $in: ids } }).lean()
      : [];
    const metaMap = {};
    metas.forEach((m) => { metaMap[m.doctorId] = m; });

    const normalized = rows.map((row) => {
      const base = mergeDoctorWithMeta(row, metaMap[row.id]);
      return {
        ...base,
        appointmentsTotal: row.appointmentsTotal || 0,
        appointmentsCompleted: row.appointmentsCompleted || 0,
        appointmentsCanceled: row.appointmentsCanceled || 0,
        earnings: parseFloat(row.earnings) || 0,
      };
    });

    return res.json({ success: true, data: normalized, doctors: normalized, meta: { page, limit, total } });
  } catch (err) {
    console.error("getDoctors:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export async function getDoctorById(req, res) {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Doctor not found" });

    const meta = await DoctorMeta.findOne({ doctorId: id }).lean();
    const out = mergeDoctorWithMeta(row, meta);
    return res.json({ success: true, data: out });
  } catch (err) {
    console.error("getDoctorById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!req.doctor || String(req.doctor._id || req.doctor.id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Not authorized to update this doctor" });
    }

    const existing = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ success: false, message: "Doctor not found" });

    const mysqlUpdate = {};

    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, "doctors");
      if (uploaded) {
        if (existing.imagePublicId && existing.imagePublicId !== (uploaded.public_id || uploaded.publicId)) {
          deleteFromCloudinary(existing.imagePublicId).catch((e) =>
            console.warn("deleteFromCloudinary warning:", e?.message || e)
          );
        }
        mysqlUpdate.imageUrl = uploaded.secure_url || uploaded.url || existing.imageUrl;
        mysqlUpdate.imagePublicId = uploaded.public_id || uploaded.publicId || existing.imagePublicId;
      }
    } else if (body.imageUrl) {
      mysqlUpdate.imageUrl = body.imageUrl;
    }

    const structuredFields = ["name", "specialization", "experience", "qualifications", "location", "fee", "availability", "success", "patients", "rating"];
    structuredFields.forEach((k) => { if (body[k] !== undefined) mysqlUpdate[k] = body[k]; });

    if (body.email && body.email !== existing.email) {
      const other = await queryOne("SELECT id FROM doctors WHERE email = ? AND id != ?", [body.email.toLowerCase(), id]);
      if (other) return res.status(409).json({ success: false, message: "Email already in use" });
      mysqlUpdate.email = body.email.toLowerCase();
    }
    if (body.password) mysqlUpdate.password = body.password;

    if (Object.keys(mysqlUpdate).length > 0) {
      await updateRow("doctors", id, mysqlUpdate);
    }

    // Update MongoDB meta (semi-structured)
    const metaUpdate = {};
    if (body.about !== undefined) metaUpdate.aboutSection = body.about;
    if (body.schedule !== undefined) metaUpdate.schedule = parseScheduleInput(body.schedule);
    if (body.achievements !== undefined) metaUpdate.achievements = body.achievements;
    if (body.testimonials !== undefined) metaUpdate.testimonials = body.testimonials;
    if (body.articleRefs !== undefined) metaUpdate.articleRefs = body.articleRefs;

    if (Object.keys(metaUpdate).length > 0) {
      await DoctorMeta.findOneAndUpdate({ doctorId: id }, metaUpdate, { upsert: true, new: true });
    }

    const row = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    const meta = await DoctorMeta.findOne({ doctorId: id }).lean();
    const out = mergeDoctorWithMeta(row, meta);
    return res.json({ success: true, data: out });
  } catch (err) {
    console.error("updateDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteDoctor(req, res) {
  try {
    const { id } = req.params;
    const existing = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ success: false, message: "Doctor not found" });

    if (existing.imagePublicId) {
      try { await deleteFromCloudinary(existing.imagePublicId); } catch (e) {
        console.warn("deleteFromCloudinary warning:", e?.message || e);
      }
    }

    await deleteRow("doctors", id);
    await DoctorMeta.deleteOne({ doctorId: id });
    return res.json({ success: true, message: "Doctor removed" });
  } catch (err) {
    console.error("deleteDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function toggleAvailability(req, res) {
  try {
    const { id } = req.params;
    if (!req.doctor || String(req.doctor._id || req.doctor.id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Not authorized to change availability for this doctor" });
    }

    const row = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Doctor not found" });

    const newAvailability = row.availability === "Available" ? "Unavailable" : "Available";
    await updateRow("doctors", id, { availability: newAvailability });

    const updated = await queryOne("SELECT * FROM doctors WHERE id = ?", [id]);
    const meta = await DoctorMeta.findOne({ doctorId: id }).lean();
    const out = mergeDoctorWithMeta(updated, meta);
    return res.json({ success: true, data: out });
  } catch (err) {
    console.error("toggleAvailability error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function doctorLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ success: false, message: "Email and password required" });

    const row = await queryOne("SELECT * FROM doctors WHERE email = ?", [email.toLowerCase()]);
    if (!row) return res.status(401).json({ success: false, message: "Invalid credentials" });

    if (row.password !== password) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ success: false, message: "JWT_SECRET not configured" });

    const token = jwt.sign({ id: row.id, email: row.email, role: "doctor" }, secret, { expiresIn: "7d" });

    const meta = await DoctorMeta.findOne({ doctorId: row.id }).lean();
    const out = mergeDoctorWithMeta(row, meta);
    return res.json({ success: true, token, data: out });
  } catch (err) {
    console.error("doctorLogin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
