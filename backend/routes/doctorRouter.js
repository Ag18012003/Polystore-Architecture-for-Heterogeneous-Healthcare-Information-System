// routes/doctorRouter.js
import express from "express";
import multer from "multer";
import rateLimit from "express-rate-limit";
import {
  createDoctor,
  getDoctors,
  getDoctorById,
  updateDoctor,
  deleteDoctor,
  toggleAvailability,
  doctorLogin,
} from "../controllers/doctorController.js";
import doctorAuth from "../middlewares/doctorAuth.js";

const upload = multer({ dest: "/tmp" });

const doctorRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many login attempts, please try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests, please try again later" },
});

doctorRouter.get("/", getDoctors);
doctorRouter.post("/login", loginLimiter, doctorLogin);
doctorRouter.get("/:id", getDoctorById);
doctorRouter.post("/", upload.single("image"), createDoctor);
doctorRouter.put("/:id", authLimiter, doctorAuth, upload.single("image"), updateDoctor);
doctorRouter.post("/:id/toggle-availability", authLimiter, doctorAuth, toggleAvailability);
doctorRouter.delete("/:id", deleteDoctor);

export default doctorRouter;
