// utils/cloudinary.js
// Cloudinary is not used in this POLYSTORE architecture.
// Image URLs are stored directly as strings in the database.

export async function uploadToCloudinary(filePath, folder = "uploads") {
  throw new Error("Cloudinary is not configured in this setup. Store image URLs directly.");
}

export async function deleteFromCloudinary(publicId) {
  // no-op
}

export default null;
