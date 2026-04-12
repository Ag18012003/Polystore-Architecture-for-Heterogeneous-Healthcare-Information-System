// routes/serviceAppointmentRouter.js
import express from "express";
import rateLimit from "express-rate-limit";
import {
  getServiceAppointments,
  getServiceAppointmentById,
  createServiceAppointment,
  confirmServicePayment,
  updateServiceAppointment,
  cancelServiceAppointment,
  getServiceAppointmentStats,
  getServiceAppointmentsByPatient,
} from "../controllers/serviceAppointmentController.js";

const router = express.Router();

const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});

const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});

router.get("/", readLimiter, getServiceAppointments);
router.get("/confirm", readLimiter, confirmServicePayment);
router.get("/stats/summary", readLimiter, getServiceAppointmentStats);
router.post("/", createLimiter, createServiceAppointment);
router.get("/me", readLimiter, getServiceAppointmentsByPatient);
router.get("/:id", readLimiter, getServiceAppointmentById);
router.put("/:id", createLimiter, updateServiceAppointment);
router.post("/:id/cancel", createLimiter, cancelServiceAppointment);

export default router;
