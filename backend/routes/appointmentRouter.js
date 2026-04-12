// routes/appointmentRouter.js
import express from "express";
import rateLimit from "express-rate-limit";
import {
  getAppointments,
  getAppointmentById,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  getStats,
  getAppointmentsByDoctor,
} from "../controllers/appointmentController.js";

const appointmentRouter = express.Router();

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

appointmentRouter.get("/", readLimiter, getAppointments);
appointmentRouter.get("/stats/summary", readLimiter, getStats);
appointmentRouter.post("/", createLimiter, createAppointment);
appointmentRouter.get("/doctor/:doctorId", readLimiter, getAppointmentsByDoctor);
appointmentRouter.get("/:id", readLimiter, getAppointmentById);
appointmentRouter.put("/:id", createLimiter, updateAppointment);
appointmentRouter.post("/:id/cancel", createLimiter, cancelAppointment);

export default appointmentRouter;
