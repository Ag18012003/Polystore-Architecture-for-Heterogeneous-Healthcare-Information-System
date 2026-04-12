// models/mongodb/DoctorMeta.js
// Semi-structured doctor data stored in MongoDB
import mongoose from "mongoose";

const doctorMetaSchema = new mongoose.Schema(
  {
    doctorId: { type: String, required: true, unique: true, index: true }, // MySQL doctor id
    aboutSection: { type: String, default: "" },
    achievements: { type: [String], default: [] },
    articleRefs: { type: [String], default: [] },
    testimonials: { type: mongoose.Schema.Types.Mixed, default: [] },
    schedule: { type: mongoose.Schema.Types.Mixed, default: {} }, // flexible scheduling map
  },
  { timestamps: true }
);

const DoctorMeta =
  mongoose.models.DoctorMeta || mongoose.model("DoctorMeta", doctorMetaSchema);

export default DoctorMeta;
