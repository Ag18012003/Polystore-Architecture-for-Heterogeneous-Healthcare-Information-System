import mongoose from "mongoose";
import { connectMySQL } from "./mysql.js";

export const connectDB = async () => {
  const mongoUri =
    process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/healthcare";
  await mongoose.connect(mongoUri);
  console.log("MongoDB connected");
  await connectMySQL();
  console.log("All databases connected");
};
