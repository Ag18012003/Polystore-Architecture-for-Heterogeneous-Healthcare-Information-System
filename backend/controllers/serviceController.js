// controllers/serviceController.js - MySQL
import Service from "../models/Service.js";

export async function createService(req, res) {
  try {
    const body = req.body || {};
    if (!body.name) {
      return res.status(400).json({ success: false, message: "name is required" });
    }

    const service = await Service.create({
      name: body.name,
      description: body.description || body.about || "",
      fee: body.fee !== undefined ? Number(body.fee) : 0,
      imageUrl: body.imageUrl || null,
      available: body.available !== undefined ? Boolean(body.available) : true,
    });

    return res.status(201).json({ success: true, data: service, message: "Service created" });
  } catch (err) {
    console.error("createService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getServices(req, res) {
  try {
    const list = await Service.findAll();
    return res.status(200).json({ success: true, data: list });
  } catch (err) {
    console.error("getServices error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function getServiceById(req, res) {
  try {
    const { id } = req.params;
    const service = await Service.findById(id);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    return res.status(200).json({ success: true, data: service });
  } catch (err) {
    console.error("getServiceById error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function updateService(req, res) {
  try {
    const { id } = req.params;
    const existing = await Service.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    const body = req.body || {};
    const updateData = {};
    if (body.name !== undefined) updateData.name = body.name;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.about !== undefined) updateData.description = body.about;
    if (body.fee !== undefined) updateData.fee = Number(body.fee);
    if (body.imageUrl !== undefined) updateData.imageUrl = body.imageUrl;
    if (body.available !== undefined) updateData.available = Boolean(body.available);

    const updated = await Service.update(id, updateData);
    return res.status(200).json({ success: true, data: updated, message: "Service updated" });
  } catch (err) {
    console.error("updateService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}

export async function deleteService(req, res) {
  try {
    const { id } = req.params;
    const existing = await Service.findById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }
    await Service.delete(id);
    return res.status(200).json({ success: true, message: "Service deleted" });
  } catch (err) {
    console.error("deleteService error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
}
