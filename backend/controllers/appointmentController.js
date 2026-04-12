// controllers/appointmentController.js - MongoDB
import Appointment from "../models/Appointment.js";
import Doctor from "../models/Doctor.js";

// Escape special regex characters to prevent regex injection
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Ensure a value is a plain string (prevents NoSQL injection via objects)
function sanitizeString(val) {
  if (val === undefined || val === null) return null;
  return String(val).trim();
}

export const getAppointments = async (req, res) => {
  try {
    const {
      doctorId,
      mobile,
      status,
      search = "",
      limit: limitRaw = 50,
      page: pageRaw = 1,
    } = req.query;

    const limit = Math.min(200, Math.max(1, parseInt(limitRaw, 10) || 50));
    const page = Math.max(1, parseInt(pageRaw, 10) || 1);
    const skip = (page - 1) * limit;

    const filter = {};
    if (doctorId) filter.doctorId = Number(doctorId);
    if (mobile) filter.mobile = sanitizeString(mobile);
    if (status) filter.status = sanitizeString(status);
    if (search) {
      const escaped = escapeRegex(sanitizeString(search));
      const re = new RegExp(escaped, "i");
      filter.$or = [{ patientName: re }, { mobile: re }];
    }

    const items = await Appointment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Appointment.countDocuments(filter);

    return res.json({
      success: true,
      appointments: items,
      meta: { page, limit, total, count: items.length },
    });
  } catch (err) {
    console.error("getAppointments:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAppointmentById = async (req, res) => {
  try {
    const { id } = req.params;
    const appt = await Appointment.findById(id).lean();
    if (!appt) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }
    return res.json({ success: true, appointment: appt });
  } catch (err) {
    console.error("getAppointmentById:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const body = req.body || {};
    const { patientName, mobile, age, gender, doctorId, date, time } = body;

    if (!patientName || !mobile || !doctorId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: "patientName, mobile, doctorId, date and time are required",
      });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor) {
      return res.status(404).json({ success: false, message: "Doctor not found" });
    }

    const appointment = await Appointment.create({
      patientName: sanitizeString(patientName),
      mobile: sanitizeString(mobile),
      age: age !== undefined ? Number(age) : null,
      gender: sanitizeString(gender) || "",
      doctorId: Number(doctorId),
      doctorName: doctor.name || "",
      specialization: doctor.specialization || "",
      doctorImage: doctor.imageUrl || "",
      date: sanitizeString(date),
      time: sanitizeString(time),
      fees: doctor.fee || 0,
      status: "Pending",
      payment: { method: "Cash", status: "Pending" },
    });

    return res.status(201).json({ success: true, data: appointment });
  } catch (err) {
    console.error("createAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const id = sanitizeString(req.params.id);
    const body = req.body || {};

    const allowedStatuses = ["Pending", "Confirmed", "Completed", "Canceled", "Rescheduled"];
    const update = {};
    if (body.status !== undefined) {
      const s = sanitizeString(body.status);
      if (allowedStatuses.includes(s)) update.status = s;
    }
    if (body.date !== undefined) update.date = sanitizeString(body.date);
    if (body.time !== undefined) update.time = sanitizeString(body.time);
    if (body.payment !== undefined && typeof body.payment === "object" && !Array.isArray(body.payment)) {
      update.payment = {
        method: sanitizeString(body.payment.method) || "Cash",
        status: sanitizeString(body.payment.status) || "Pending",
      };
    }

    const updated = await Appointment.findByIdAndUpdate(id, update, {
      new: true,
      runValidators: true,
    }).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    return res.json({ success: true, data: updated });
  } catch (err) {
    console.error("updateAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const cancelAppointment = async (req, res) => {
  try {
    const id = sanitizeString(req.params.id);
    const updated = await Appointment.findByIdAndUpdate(
      id,
      { status: "Canceled" },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ success: false, message: "Appointment not found" });
    }

    return res.json({ success: true, data: updated, message: "Appointment canceled" });
  } catch (err) {
    console.error("cancelAppointment:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getAppointmentsByDoctor = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const items = await Appointment.find({ doctorId: Number(doctorId) })
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ success: true, appointments: items });
  } catch (err) {
    console.error("getAppointmentsByDoctor:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export const getStats = async (req, res) => {
  try {
    const total = await Appointment.countDocuments();
    const pending = await Appointment.countDocuments({ status: "Pending" });
    const confirmed = await Appointment.countDocuments({ status: "Confirmed" });
    const completed = await Appointment.countDocuments({ status: "Completed" });
    const canceled = await Appointment.countDocuments({ status: "Canceled" });
    return res.json({ success: true, data: { total, pending, confirmed, completed, canceled } });
  } catch (err) {
    console.error("getStats:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};
