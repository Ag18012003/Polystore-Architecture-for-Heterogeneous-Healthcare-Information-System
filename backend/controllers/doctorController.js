// controllers/doctorController.js
import jwt from "jsonwebtoken";
import { pool } from "../config/mysql.js";
import Appointment from "../models/Appointment.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

/* ------------ MySQL row → API object ------------ */

function rowToDoc(row) {
  if (!row) return null;
  let schedule = {};
  if (row.schedule) {
    try {
      schedule =
        typeof row.schedule === "string"
          ? JSON.parse(row.schedule)
          : row.schedule;
    } catch {
      schedule = {};
    }
  }
  return {
    id: row.id,
    _id: String(row.id), // kept for frontend compatibility
    email: row.email,
    name: row.name || "",
    specialization: row.specialization || "",
    experience: row.experience || "",
    qualifications: row.qualifications || "",
    location: row.location || "",
    about: row.about || "",
    fee: parseFloat(row.fee) || 0,
    fees: parseFloat(row.fee) || 0,
    availability: row.availability || "Available",
    imageUrl: row.image_url || null,
    imagePublicId: row.image_public_id || null,
    schedule,
    success: row.success || "",
    patients: row.patients || "",
    rating: parseFloat(row.rating) || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------ CREATE ------------ */

export async function createDoctor(req, res) {
  try {
    const body = req.body || {};
    if (!body.email || !body.password || !body.name) {
      return res
        .status(400)
        .json({ success: false, message: "email, password and name are required" });
    }

    const emailLC = body.email.toLowerCase();
    const [existing] = await pool.query(
      "SELECT id FROM doctors WHERE email = ?",
      [emailLC]
    );
    if (existing.length > 0) {
      return res
        .status(409)
        .json({ success: false, message: "Email already in use" });
    }

    let imageUrl = body.imageUrl || null;
    let imagePublicId = body.imagePublicId || null;
    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, "doctors");
      imageUrl = uploaded?.secure_url || uploaded?.url || imageUrl;
      imagePublicId = uploaded?.public_id || uploaded?.publicId || imagePublicId;
    }

    const schedule =
      body.schedule
        ? typeof body.schedule === "string"
          ? body.schedule
          : JSON.stringify(body.schedule)
        : "{}";

    const [result] = await pool.query(
      `INSERT INTO doctors
         (email, password, name, specialization, experience, qualifications,
          location, about, fee, availability, image_url, image_public_id,
          schedule, success, patients, rating)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emailLC,
        body.password,
        body.name,
        body.specialization || "",
        body.experience || "",
        body.qualifications || "",
        body.location || "",
        body.about || "",
        body.fee ? Number(body.fee) : 0,
        body.availability || "Available",
        imageUrl,
        imagePublicId,
        schedule,
        body.success || "",
        body.patients || "",
        body.rating ? Number(body.rating) : 0,
      ]
    );

    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [
      result.insertId,
    ]);
    const doc = rowToDoc(rows[0]);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      console.warn("JWT_SECRET is not set");
      return res
        .status(500)
        .json({ success: false, message: "Server misconfiguration" });
    }

    const token = jwt.sign(
      { id: doc.id, email: doc.email, role: "doctor" },
      secret,
      { expiresIn: "7d" }
    );

    return res.status(201).json({ success: true, data: doc, token });
  } catch (err) {
    console.error("createDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ GET ALL ------------ */

export const getDoctors = async (req, res) => {
  try {
    const {
      q = "",
      limit: limitRaw = 200,
      page: pageRaw = 1,
    } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 200));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    let baseWhere = "";
    const whereParams = [];

    if (q && typeof q === "string" && q.trim()) {
      const search = `%${q.trim()}%`;
      baseWhere = " WHERE (name LIKE ? OR specialization LIKE ? OR email LIKE ?)";
      whereParams.push(search, search, search);
    }

    const [rows] = await pool.query(
      `SELECT * FROM doctors${baseWhere} ORDER BY name ASC LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM doctors${baseWhere}`,
      whereParams
    );

    // Gather appointment stats from MongoDB
    const doctorIds = rows.map((r) => String(r.id));
    const apptStats = {};
    if (doctorIds.length > 0) {
      const stats = await Appointment.aggregate([
        { $match: { doctorId: { $in: doctorIds } } },
        {
          $group: {
            _id: "$doctorId",
            appointmentsTotal: { $sum: 1 },
            appointmentsCompleted: {
              $sum: {
                $cond: [{ $in: ["$status", ["Confirmed", "Completed"]] }, 1, 0],
              },
            },
            appointmentsCanceled: {
              $sum: { $cond: [{ $eq: ["$status", "Canceled"] }, 1, 0] },
            },
            earnings: {
              $sum: {
                $cond: [
                  { $in: ["$status", ["Confirmed", "Completed"]] },
                  { $ifNull: ["$fees", 0] },
                  0,
                ],
              },
            },
          },
        },
      ]);
      stats.forEach((s) => {
        apptStats[s._id] = s;
      });
    }

    const normalized = rows.map((r) => {
      const doc = rowToDoc(r);
      const stats = apptStats[String(r.id)] || {};
      return {
        ...doc,
        appointmentsTotal: stats.appointmentsTotal || 0,
        appointmentsCompleted: stats.appointmentsCompleted || 0,
        appointmentsCanceled: stats.appointmentsCanceled || 0,
        earnings: stats.earnings || 0,
      };
    });

    return res.json({
      success: true,
      data: normalized,
      doctors: normalized,
      meta: { page, limit, total },
    });
  } catch (err) {
    console.error("getDoctors:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

/* ------------ GET BY ID ------------ */

export async function getDoctorById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }
    return res.json({ success: true, data: rowToDoc(rows[0]) });
  } catch (err) {
    console.error("getDoctorById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ UPDATE ------------ */

export async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!req.doctor || String(req.doctor.id) !== String(id)) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized to update this doctor" });
    }

    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }
    const existing = rows[0];

    let imageUrl = existing.image_url;
    let imagePublicId = existing.image_public_id;

    if (req.file?.path) {
      const uploaded = await uploadToCloudinary(req.file.path, "doctors");
      if (uploaded) {
        const prevPublicId = imagePublicId;
        imageUrl = uploaded.secure_url || uploaded.url || imageUrl;
        imagePublicId =
          uploaded.public_id || uploaded.publicId || imagePublicId;
        if (prevPublicId && prevPublicId !== imagePublicId) {
          deleteFromCloudinary(prevPublicId).catch((e) =>
            console.warn("deleteFromCloudinary warning:", e?.message || e)
          );
        }
      }
    } else if (body.imageUrl) {
      imageUrl = body.imageUrl;
    }

    const fields = [];
    const vals = [];

    const colMap = {
      name: "name",
      specialization: "specialization",
      experience: "experience",
      qualifications: "qualifications",
      location: "location",
      about: "about",
      fee: "fee",
      availability: "availability",
      success: "success",
      patients: "patients",
      rating: "rating",
    };

    Object.entries(colMap).forEach(([bodyKey, col]) => {
      if (body[bodyKey] !== undefined) {
        fields.push(`${col} = ?`);
        vals.push(body[bodyKey]);
      }
    });

    if (body.schedule !== undefined) {
      fields.push("schedule = ?");
      vals.push(
        typeof body.schedule === "string"
          ? body.schedule
          : JSON.stringify(body.schedule)
      );
    }

    fields.push("image_url = ?", "image_public_id = ?");
    vals.push(imageUrl, imagePublicId);

    if (body.email && body.email.toLowerCase() !== existing.email) {
      const emailLC = body.email.toLowerCase();
      const [others] = await pool.query(
        "SELECT id FROM doctors WHERE email = ? AND id != ?",
        [emailLC, id]
      );
      if (others.length > 0) {
        return res
          .status(409)
          .json({ success: false, message: "Email already in use" });
      }
      fields.push("email = ?");
      vals.push(emailLC);
    }

    if (body.password) {
      fields.push("password = ?");
      vals.push(body.password);
    }

    if (fields.length > 0) {
      vals.push(id);
      await pool.query(
        `UPDATE doctors SET ${fields.join(", ")} WHERE id = ?`,
        vals
      );
    }

    const [updated] = await pool.query("SELECT * FROM doctors WHERE id = ?", [
      id,
    ]);
    return res.json({ success: true, data: rowToDoc(updated[0]) });
  } catch (err) {
    console.error("updateDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ DELETE ------------ */

export async function deleteDoctor(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }
    const existing = rows[0];

    if (existing.image_public_id) {
      try {
        await deleteFromCloudinary(existing.image_public_id);
      } catch (e) {
        console.warn("deleteFromCloudinary warning:", e?.message || e);
      }
    }

    await pool.query("DELETE FROM doctors WHERE id = ?", [id]);
    return res.json({ success: true, message: "Doctor removed" });
  } catch (err) {
    console.error("deleteDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ TOGGLE AVAILABILITY ------------ */

export async function toggleAvailability(req, res) {
  try {
    const { id } = req.params;
    if (!req.doctor || String(req.doctor.id) !== String(id)) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to change availability for this doctor",
      });
    }

    const [rows] = await pool.query("SELECT * FROM doctors WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Doctor not found" });
    }
    const current = rows[0];
    const newAvailability =
      current.availability === "Available" ? "Unavailable" : "Available";

    await pool.query("UPDATE doctors SET availability = ? WHERE id = ?", [
      newAvailability,
      id,
    ]);
    const [updated] = await pool.query("SELECT * FROM doctors WHERE id = ?", [
      id,
    ]);
    return res.json({ success: true, data: rowToDoc(updated[0]) });
  } catch (err) {
    console.error("toggleAvailability error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ LOGIN ------------ */

export async function doctorLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res
        .status(400)
        .json({ success: false, message: "Email and password required" });
    }

    const [rows] = await pool.query(
      "SELECT * FROM doctors WHERE email = ?",
      [email.toLowerCase()]
    );
    if (!rows.length) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }
    const row = rows[0];

    // Direct comparison (no bcrypt)
    if (row.password !== password) {
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res
        .status(500)
        .json({ success: false, message: "JWT_SECRET not configured" });
    }

    const token = jwt.sign(
      { id: row.id, email: row.email, role: "doctor" },
      secret,
      { expiresIn: "7d" }
    );

    const data = rowToDoc(row);
    return res.json({ success: true, token, data });
  } catch (err) {
    console.error("doctorLogin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

