// controllers/serviceController.js
import { pool } from "../config/mysql.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

/* ------------ helpers ------------ */

const parseJsonArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
      return typeof parsed === "string" ? [parsed] : [];
    } catch {
      return field
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
  }
  return [];
};

function normalizeSlotsToMap(slotStrings = []) {
  const map = {};
  slotStrings.forEach((raw) => {
    const m = raw.match(
      /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
    );
    if (!m) {
      map["unspecified"] = map["unspecified"] || [];
      map["unspecified"].push(raw);
      return;
    }
    const [, day, monShort, year, hour, minute, ampm] = m;
    const monthIdx = [
      "Jan","Feb","Mar","Apr","May","Jun",
      "Jul","Aug","Sep","Oct","Nov","Dec",
    ].findIndex((x) => x.toLowerCase() === monShort.toLowerCase());
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(Number(day)).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    const timeStr = `${String(Number(hour)).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm.toUpperCase()}`;
    map[dateKey] = map[dateKey] || [];
    map[dateKey].push(timeStr);
  });
  return map;
}

const sanitizePrice = (v) =>
  Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0;

const parseAvailability = (v) => {
  const s = String(v ?? "available").toLowerCase();
  return s === "available" || s === "true" ? 1 : 0;
};

function rowToService(row) {
  if (!row) return null;
  let instructions = [];
  let slots = {};
  try {
    instructions =
      typeof row.instructions === "string"
        ? JSON.parse(row.instructions)
        : row.instructions || [];
  } catch {
    instructions = [];
  }
  try {
    slots =
      typeof row.slots === "string" ? JSON.parse(row.slots) : row.slots || {};
  } catch {
    slots = {};
  }
  return {
    id: row.id,
    _id: String(row.id),
    name: row.name || "",
    about: row.about || "",
    shortDescription: row.short_description || "",
    price: parseFloat(row.price) || 0,
    available: !!row.available,
    imageUrl: row.image_url || null,
    imagePublicId: row.image_public_id || null,
    instructions,
    slots,
    totalAppointments: row.total_appointments || 0,
    completed: row.completed || 0,
    canceled: row.canceled || 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/* ------------ CREATE ------------ */

export async function createService(req, res) {
  try {
    const b = req.body || {};
    const instructions = parseJsonArrayField(b.instructions);
    const rawSlots = parseJsonArrayField(b.slots);
    const slots = normalizeSlotsToMap(rawSlots);
    const numericPrice = sanitizePrice(b.price);
    const available = parseAvailability(b.availability);

    let imageUrl = null;
    let imagePublicId = null;
    if (req.file) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        imageUrl = up?.secure_url || null;
        imagePublicId = up?.public_id || null;
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    const [result] = await pool.query(
      `INSERT INTO services
         (name, about, short_description, price, available, image_url,
          image_public_id, instructions, slots)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        b.name,
        b.about || "",
        b.shortDescription || "",
        numericPrice,
        available,
        imageUrl,
        imagePublicId,
        JSON.stringify(instructions),
        JSON.stringify(slots),
      ]
    );

    const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [
      result.insertId,
    ]);
    return res
      .status(201)
      .json({ success: true, data: rowToService(rows[0]), message: "Service created" });
  } catch (err) {
    console.error("createService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ GET ALL ------------ */

export async function getServices(req, res) {
  try {
    const [rows] = await pool.query(
      "SELECT * FROM services ORDER BY created_at DESC"
    );
    return res
      .status(200)
      .json({ success: true, data: rows.map(rowToService) });
  } catch (err) {
    console.error("getServices error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ GET BY ID ------------ */

export async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }
    return res.status(200).json({ success: true, data: rowToService(rows[0]) });
  } catch (err) {
    console.error("getServiceById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ UPDATE ------------ */

export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }
    const existing = rows[0];
    const b = req.body || {};

    const fields = [];
    const vals = [];

    if (b.name !== undefined) { fields.push("name = ?"); vals.push(b.name); }
    if (b.about !== undefined) { fields.push("about = ?"); vals.push(b.about); }
    if (b.shortDescription !== undefined) { fields.push("short_description = ?"); vals.push(b.shortDescription); }
    if (b.price !== undefined) { fields.push("price = ?"); vals.push(sanitizePrice(b.price)); }
    if (b.availability !== undefined) { fields.push("available = ?"); vals.push(parseAvailability(b.availability)); }
    if (b.instructions !== undefined) {
      fields.push("instructions = ?");
      vals.push(JSON.stringify(parseJsonArrayField(b.instructions)));
    }
    if (b.slots !== undefined) {
      fields.push("slots = ?");
      vals.push(JSON.stringify(normalizeSlotsToMap(parseJsonArrayField(b.slots))));
    }

    if (req.file) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        if (up?.secure_url) {
          if (existing.image_public_id) {
            try {
              await deleteFromCloudinary(existing.image_public_id);
            } catch (e) {
              console.warn("Cloudinary delete failed:", e?.message || e);
            }
          }
          fields.push("image_url = ?", "image_public_id = ?");
          vals.push(up.secure_url, up.public_id || null);
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    if (fields.length > 0) {
      vals.push(id);
      await pool.query(`UPDATE services SET ${fields.join(", ")} WHERE id = ?`, vals);
    }

    const [updated] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
    return res
      .status(200)
      .json({ success: true, data: rowToService(updated[0]), message: "Service updated" });
  } catch (err) {
    console.error("updateService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* ------------ DELETE ------------ */

export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM services WHERE id = ?", [id]);
    if (!rows.length) {
      return res
        .status(404)
        .json({ success: false, message: "Service not found" });
    }
    const existing = rows[0];

    if (existing.image_public_id) {
      try {
        await deleteFromCloudinary(existing.image_public_id);
      } catch (e) {
        console.warn("failed to delete cloud image on service delete:", e?.message || e);
      }
    }

    await pool.query("DELETE FROM services WHERE id = ?", [id]);
    return res.status(200).json({ success: true, message: "Service deleted" });
  } catch (err) {
    console.error("deleteService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
