// models/mongodb/ServiceAppointmentMeta.js
// Semi-structured service appointment data stored in MongoDB
import mongoose from "mongoose";

const serviceAppointmentMetaSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, required: true, unique: true, index: true }, // MySQL service_appointment id
    notes: { type: String, default: "" },
    paymentMeta: { type: mongoose.Schema.Types.Mixed, default: {} },
    auditLog: {
      type: [
        {
          action: String,
          changedBy: String,
          changedAt: { type: Date, default: Date.now },
          details: mongoose.Schema.Types.Mixed,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const ServiceAppointmentMeta =
  mongoose.models.ServiceAppointmentMeta ||
  mongoose.model("ServiceAppointmentMeta", serviceAppointmentMetaSchema);

export default ServiceAppointmentMeta;
