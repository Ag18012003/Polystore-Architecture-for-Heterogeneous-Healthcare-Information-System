// models/serviceAppointment.js - MongoDB (Mongoose) model
import mongoose from "mongoose";

const serviceAppointmentSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    mobile: { type: String, required: true, trim: true },
    age: { type: Number, min: 0 },
    gender: { type: String, enum: ["Male", "Female", "Other", ""], default: "" },

    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Service",
      required: true,
    },
    serviceName: { type: String, required: true },
    serviceImage: {
      url: { type: String, default: "" },
    },

    fees: { type: Number, required: true, min: 0 },

    date: { type: String, required: true, index: true },
    hour: { type: Number, required: true },
    minute: { type: Number, required: true },
    ampm: { type: String, enum: ["AM", "PM"], required: true },

    status: {
      type: String,
      enum: ["Pending", "Confirmed", "Rescheduled", "Completed", "Canceled"],
      default: "Pending",
      index: true,
    },

    rescheduledTo: {
      date: { type: String },
      hour: { type: Number },
      minute: { type: Number },
      ampm: { type: String, enum: ["AM", "PM"] },
    },

    payment: {
      method: { type: String, enum: ["Cash", "Online"], default: "Cash" },
      status: {
        type: String,
        enum: ["Pending", "Paid", "Failed", "Refunded"],
        default: "Pending",
      },
      amount: { type: Number, required: true },
    },
  },
  { timestamps: true }
);

serviceAppointmentSchema.index({ date: 1, status: 1 });
serviceAppointmentSchema.index({ serviceId: 1 });

const ServiceAppointment =
  mongoose.models.ServiceAppointment ||
  mongoose.model("ServiceAppointment", serviceAppointmentSchema);

export default ServiceAppointment;
