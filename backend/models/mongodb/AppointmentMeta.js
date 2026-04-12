// models/mongodb/AppointmentMeta.js
// Semi-structured appointment data stored in MongoDB
import mongoose from "mongoose";

const appointmentMetaSchema = new mongoose.Schema(
  {
    appointmentId: { type: String, required: true, unique: true, index: true }, // MySQL appointment id
    notes: { type: String, default: "" },
    specialRequirements: { type: String, default: "" },
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

const AppointmentMeta =
  mongoose.models.AppointmentMeta ||
  mongoose.model("AppointmentMeta", appointmentMetaSchema);

export default AppointmentMeta;
