// controllers/doctorController.js - MySQL
import jwt from "jsonwebtoken";
import Doctor from "../models/Doctor.js";

const sanitizeDoctor = (doc) => {
  if (!doc) return null;
  const out = { ...doc };
  delete out.password;
  return out;
};

export async function createDoctor(req, res) {
  try {
    const body = req.body || {};
    if (!body.email || !body.password || !body.name) {
      return res.status(400).json({ success: false, message: "email, password and name are required" });
    }

    const existing = await Doctor.findByEmail(body.email);
    if (existing) {
      return res.status(409).json({ success: false, message: "Email already in use" });
    }

    const doc = await Doctor.create({
      email: body.email,
      password: body.password,
      name: body.name,
      specialization: body.specialization || "",
      fee: body.fee !== undefined ? Number(body.fee) : 0,
      experience: body.experience || "",
      qualifications: body.qualifications || "",
      location: body.location || "",
      imageUrl: body.imageUrl || null,
      availability: body.availability || "Available",
      about: body.about || "",
    });

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "Server misconfiguration" });
    }

    const token = jwt.sign(
      { id: doc.id, email: doc.email, role: "doctor" },
      secret,
      { expiresIn: "7d" }
    );

    return res.status(201).json({ success: true, data: sanitizeDoctor(doc), token });
  } catch (err) {
    console.error("createDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getDoctors(req, res) {
  try {
    const { q = "", limit: limitRaw = 200, page: pageRaw = 1 } = req.query;
    const limit = Math.min(500, Math.max(1, parseInt(limitRaw, 10) || 200));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const offset = (page - 1) * limit;

    const docs = await Doctor.findAll({ search: q, limit, offset });
    const total = await Doctor.countAll({ search: q });

    const normalized = docs.map((d) => ({ ...sanitizeDoctor(d), id: d.id }));

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
}

export async function getDoctorById(req, res) {
  try {
    const { id } = req.params;
    const doc = await Doctor.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Doctor not found" });
    return res.json({ success: true, data: sanitizeDoctor(doc) });
  } catch (err) {
    console.error("getDoctorById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateDoctor(req, res) {
  try {
    const { id } = req.params;
    const body = req.body || {};

    if (!req.doctor || String(req.doctor.id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Not authorized to update this doctor" });
    }

    const existing = await Doctor.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Doctor not found" });

    if (body.email && body.email.toLowerCase() !== existing.email) {
      const other = await Doctor.findByEmail(body.email);
      if (other && String(other.id) !== String(id)) {
        return res.status(409).json({ success: false, message: "Email already in use" });
      }
    }

    const updated = await Doctor.update(id, body);
    return res.json({ success: true, data: sanitizeDoctor(updated) });
  } catch (err) {
    console.error("updateDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteDoctor(req, res) {
  try {
    const { id } = req.params;
    const existing = await Doctor.findById(id);
    if (!existing) return res.status(404).json({ success: false, message: "Doctor not found" });
    await Doctor.delete(id);
    return res.json({ success: true, message: "Doctor removed" });
  } catch (err) {
    console.error("deleteDoctor error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function toggleAvailability(req, res) {
  try {
    const { id } = req.params;
    if (!req.doctor || String(req.doctor.id) !== String(id)) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    const doc = await Doctor.findById(id);
    if (!doc) return res.status(404).json({ success: false, message: "Doctor not found" });

    const newAvailability = doc.availability === "Available" ? "Unavailable" : "Available";
    const updated = await Doctor.update(id, { availability: newAvailability });
    return res.json({ success: true, data: sanitizeDoctor(updated) });
  } catch (err) {
    console.error("toggleAvailability error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function doctorLogin(req, res) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "Email and password required" });
    }

    const doc = await Doctor.findByEmail(email);
    if (!doc) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    if (doc.password !== password) {
      return res.status(401).json({ success: false, message: "Invalid credentials" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ success: false, message: "JWT_SECRET not configured" });
    }

    const token = jwt.sign(
      { id: doc.id, email: doc.email, role: "doctor" },
      secret,
      { expiresIn: "7d" }
    );

    return res.json({ success: true, token, data: sanitizeDoctor(doc) });
  } catch (err) {
    console.error("doctorLogin error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
