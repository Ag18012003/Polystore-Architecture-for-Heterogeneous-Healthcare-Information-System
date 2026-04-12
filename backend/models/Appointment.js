// models/Appointment.js - MongoDB (Mongoose) model
import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    age: { type: Number, default: null },
    gender: { type: String, default: "" },

    doctorId: { type: Number, required: true, index: true },
    doctorName: { type: String, default: "" },
    specialization: { type: String, default: "" },
    doctorImage: { type: String, default: "" },

    date: { type: String, required: true },
    time: { type: String, required: true },
    fees: { type: Number, required: true, min: 0, default: 0 },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Completed", "Canceled", "Rescheduled"],
      default: "Pending",
    },

    payment: {
      method: { type: String, enum: ["Cash", "Online"], default: "Cash" },
      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending",
      },
    },
  },
  { timestamps: true }
);

const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);

export default Appointment;
