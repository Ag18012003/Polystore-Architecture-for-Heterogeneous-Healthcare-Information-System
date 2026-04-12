// controllers/serviceController.js
// Polystore: structured data → MySQL, semi-structured data → MongoDB (ServiceMeta)
import pool from "../config/mysql.js";
import ServiceMeta from "../models/mongodb/ServiceMeta.js";
import { uploadToCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import {
  newId,
  query,
  queryOne,
  insertRow,
  updateRow,
  deleteRow,
  mapServiceRow,
} from "../utils/queryHelpers.js";

/* -----------------------
   Helpers
   ----------------------- */
const parseJsonArrayField = (field) => {
  if (!field) return [];
  if (Array.isArray(field)) return field;
  if (typeof field === "string") {
    try {
      const parsed = JSON.parse(field);
      if (Array.isArray(parsed)) return parsed;
      return typeof parsed === "string" ? [parsed] : [];
    } catch {
      return field.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }
  return [];
};

function normalizeSlotsToMap(slotStrings = []) {
  const map = {};
  slotStrings.forEach((raw) => {
    const m = raw.match(/^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s*•\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!m) {
      map["unspecified"] = map["unspecified"] || [];
      map["unspecified"].push(raw);
      return;
    }
    const [, day, monShort, year, hour, minute, ampm] = m;
    const monthIdx = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
      .findIndex((x) => x.toLowerCase() === monShort.toLowerCase());
    const mm = String(monthIdx + 1).padStart(2, "0");
    const dd = String(Number(day)).padStart(2, "0");
    const dateKey = `${year}-${mm}-${dd}`;
    const timeStr = `${String(Number(hour)).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${ampm.toUpperCase()}`;
    map[dateKey] = map[dateKey] || [];
    map[dateKey].push(timeStr);
  });
  return map;
}

const sanitizePrice = (v) => Number(String(v ?? "0").replace(/[^\d.-]/g, "")) || 0;
const parseAvailability = (v) => {
  const s = String(v ?? "available").toLowerCase();
  return s === "available" || s === "true" ? 1 : 0;
};

function mergeServiceWithMeta(row, meta) {
  const base = mapServiceRow(row);
  if (!base) return null;
  if (meta) {
    base.instructions = meta.instructions || [];
    base.dates = meta.dates || [];
    base.slots = meta.slots || {};
    base.specialNotes = meta.specialNotes || "";
  }
  return base;
}

/* -----------------------
   CREATE
   ----------------------- */
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

    const id = newId();

    // Insert structured fields into MySQL
    await insertRow("services", {
      id,
      name: b.name,
      about: b.about || "",
      shortDescription: b.shortDescription || "",
      price: numericPrice,
      available,
      imageUrl,
      imagePublicId,
    });

    // Insert semi-structured fields into MongoDB
    await ServiceMeta.create({
      serviceId: id,
      instructions,
      dates: parseJsonArrayField(b.dates),
      slots,
      specialNotes: b.specialNotes || "",
    });

    const row = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
    const meta = await ServiceMeta.findOne({ serviceId: id }).lean();
    const result = mergeServiceWithMeta(row, meta);
    return res.status(201).json({ success: true, data: result, message: "Service created" });
  } catch (err) {
    console.error("createService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* -----------------------
   GET ALL
   ----------------------- */
export async function getServices(req, res) {
  try {
    const rows = await query("SELECT * FROM services ORDER BY createdAt DESC");
    const ids = rows.map((r) => r.id);
    const metas = ids.length
      ? await ServiceMeta.find({ serviceId: { $in: ids } }).lean()
      : [];
    const metaMap = {};
    metas.forEach((m) => { metaMap[m.serviceId] = m; });

    const list = rows.map((row) => mergeServiceWithMeta(row, metaMap[row.id]));
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    console.error("getServices error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* -----------------------
   GET BY ID
   ----------------------- */
export async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const row = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
    if (!row) return res.status(404).json({ success: false, message: "Service not found" });
    const meta = await ServiceMeta.findOne({ serviceId: id }).lean();
    return res.status(200).json({ success: true, data: mergeServiceWithMeta(row, meta) });
  } catch (err) {
    console.error("getServiceById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* -----------------------
   UPDATE (partial)
   ----------------------- */
export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const existing = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ success: false, message: "Service not found" });

    const b = req.body || {};
    const mysqlUpdate = {};

    if (b.name !== undefined) mysqlUpdate.name = b.name;
    if (b.about !== undefined) mysqlUpdate.about = b.about;
    if (b.shortDescription !== undefined) mysqlUpdate.shortDescription = b.shortDescription;
    if (b.price !== undefined) mysqlUpdate.price = sanitizePrice(b.price);
    if (b.availability !== undefined) mysqlUpdate.available = parseAvailability(b.availability);

    if (req.file) {
      try {
        const up = await uploadToCloudinary(req.file.path, "services");
        if (up?.secure_url) {
          mysqlUpdate.imageUrl = up.secure_url;
          mysqlUpdate.imagePublicId = up.public_id || null;
          if (existing.imagePublicId) {
            deleteFromCloudinary(existing.imagePublicId).catch((err) =>
              console.warn("Cloudinary delete failed:", err?.message || err)
            );
          }
        }
      } catch (err) {
        console.error("Cloudinary upload error:", err);
      }
    }

    if (Object.keys(mysqlUpdate).length > 0) {
      await updateRow("services", id, mysqlUpdate);
    }

    // Update MongoDB meta
    const metaUpdate = {};
    if (b.instructions !== undefined) metaUpdate.instructions = parseJsonArrayField(b.instructions);
    if (b.slots !== undefined) metaUpdate.slots = normalizeSlotsToMap(parseJsonArrayField(b.slots));
    if (b.dates !== undefined) metaUpdate.dates = parseJsonArrayField(b.dates);
    if (b.specialNotes !== undefined) metaUpdate.specialNotes = b.specialNotes;

    if (Object.keys(metaUpdate).length > 0) {
      await ServiceMeta.findOneAndUpdate({ serviceId: id }, metaUpdate, { upsert: true, new: true });
    }

    const row = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
    const meta = await ServiceMeta.findOne({ serviceId: id }).lean();
    return res.status(200).json({ success: true, data: mergeServiceWithMeta(row, meta), message: "Service updated" });
  } catch (err) {
    console.error("updateService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

/* -----------------------
   DELETE
   ----------------------- */
export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const existing = await queryOne("SELECT * FROM services WHERE id = ?", [id]);
    if (!existing) return res.status(404).json({ success: false, message: "Service not found" });

    if (existing.imagePublicId) {
      deleteFromCloudinary(existing.imagePublicId).catch((err) =>
        console.warn("failed to delete cloud image on service delete:", err?.message || err)
      );
    }

    await deleteRow("services", id);
    await ServiceMeta.deleteOne({ serviceId: id });
    return res.status(200).json({ success: true, message: "Service deleted" });
  } catch (err) {
    console.error("deleteService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
