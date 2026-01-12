import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";
import { createRequire } from "module";

const require = createRequire(import.meta.url);

dotenv.config();

// CommonJS require (bypasses ESM problems)
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "products",
    allowed_formats: ["webp", "jpg", "jpeg", "png"],
  },
});

export const upload = multer({ storage });
export default cloudinary;
