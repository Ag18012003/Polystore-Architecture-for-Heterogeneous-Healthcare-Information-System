// models/mongodb/ServiceMeta.js
// Semi-structured service data stored in MongoDB
import mongoose from "mongoose";

const serviceMetaSchema = new mongoose.Schema(
  {
    serviceId: { type: String, required: true, unique: true, index: true }, // MySQL service id
    instructions: { type: [String], default: [] },
    dates: { type: [String], default: [] },
    slots: { type: mongoose.Schema.Types.Mixed, default: {} }, // { "YYYY-MM-DD": ["HH:MM AM"] }
    specialNotes: { type: String, default: "" },
  },
  { timestamps: true }
);

const ServiceMeta =
  mongoose.models.ServiceMeta || mongoose.model("ServiceMeta", serviceMetaSchema);

export default ServiceMeta;
