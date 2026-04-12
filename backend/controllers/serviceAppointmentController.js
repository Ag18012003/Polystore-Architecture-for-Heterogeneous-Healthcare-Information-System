// controllers/serviceAppointmentController.js - MongoDB
import ServiceAppointment from "../models/serviceAppointment.js";
import Service from "../models/Service.js";

// Ensure a value is a plain string (prevents NoSQL injection via objects)
function sanitizeString(val) {
  if (val === undefined || val === null) return null;
  return String(val).trim();
}

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

export const getServiceAppointments = async (req, res) => {
  try {
    const { serviceId, status, limit: limitRaw = 50, page: pageRaw = 1 } = req.query;
    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (serviceId) filter.serviceId = sanitizeString(serviceId);
    if (status) filter.status = sanitizeString(status);

    const items = await ServiceAppointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    const total = await ServiceAppointment.countDocuments(filter);

    return res.json({ success: true, appointments: items, meta: { page, limit, total } });
  } catch (err) {
    console.error("getServiceAppointments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getServiceAppointmentById = async (req, res) => {
  try {
    const id = sanitizeString(req.params.id);
    const appt = await ServiceAppointment.findById(id).lean();
    if (!appt) return res.status(404).json({ success: false, message: "Service appointment not found" });
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("getServiceAppointmentById:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createServiceAppointment = async (req, res) => {
  try {
    const body = req.body || {};
    const { serviceId, patientName, mobile, age, gender, date, time } = body;

    if (!serviceId || !patientName || !mobile || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "serviceId, patientName, mobile, date and time are required",
      });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ success: false, message: "Service not found" });
    }

    const parsed = parseTimeString(time);
    if (!parsed) {
      return res.status(400).json({ success: false, message: "Invalid time format" });
    }

    const appt = await ServiceAppointment.create({
      serviceId,
      serviceName: service.name,
      serviceImage: { url: service.imageUrl || "" },
      patientName,
      mobile,
      age: age !== undefined ? Number(age) : undefined,
      gender: gender || "",
      date,
      hour: parsed.hour,
      minute: parsed.minute,
      ampm: parsed.ampm,
      fees: service.fee || 0,
      status: "Pending",
      payment: {
        method: "Cash",
        status: "Pending",
        amount: service.fee || 0,
      },
    });

    return res.status(201).json({ success: true, data: appt });
  } catch (err) {
    console.error("createServiceAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const confirmServicePayment = async (req, res) => {
  return res.json({ success: true, message: "No payment gateway configured" });
};

export const updateServiceAppointment = async (req, res) => {
  try {
    const id = sanitizeString(req.params.id);
    const body = req.body || {};
    const allowedStatuses = ["Pending", "Confirmed", "Completed", "Canceled", "Rescheduled"];
    const update = {};
    if (body.status !== undefined) {
      const s = sanitizeString(body.status);
      if (allowedStatuses.includes(s)) update.status = s;
    }
    if (body.payment !== undefined && typeof body.payment === "object" && !Array.isArray(body.payment)) {
      update.payment = {
        method: sanitizeString(body.payment.method) || "Cash",
        status: sanitizeString(body.payment.status) || "Pending",
        amount: typeof body.payment.amount === "number" ? body.payment.amount : undefined,
      };
    }

    const updated = await ServiceAppointment.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) return res.status(404).json({ success: false, message: "Service appointment not found" });
    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateServiceAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const cancelServiceAppointment = async (req, res) => {
  try {
    const id = sanitizeString(req.params.id);
    const updated = await ServiceAppointment.findByIdAndUpdate(
      id,
      { status: "Canceled" },
      { new: true }
    ).lean();
    if (!updated) return res.status(404).json({ success: false, message: "Service appointment not found" });
    return res.json({ success: true, data: updated, message: "Appointment canceled" });
  } catch (err) {
    console.error("cancelServiceAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getServiceAppointmentStats = async (req, res) => {
  try {
    const total = await ServiceAppointment.countDocuments();
    const pending = await ServiceAppointment.countDocuments({ status: "Pending" });
    const confirmed = await ServiceAppointment.countDocuments({ status: "Confirmed" });
    const completed = await ServiceAppointment.countDocuments({ status: "Completed" });
    const canceled = await ServiceAppointment.countDocuments({ status: "Canceled" });
    return res.json({ success: true, data: { total, pending, confirmed, completed, canceled } });
  } catch (err) {
    console.error("getServiceAppointmentStats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getServiceAppointmentsByPatient = async (req, res) => {
  try {
    const { mobile } = req.query;
    const filter = {};
    if (mobile) filter.mobile = sanitizeString(mobile);
    const items = await ServiceAppointment.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, appointments: items });
  } catch (err) {
    console.error("getServiceAppointmentsByPatient:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
