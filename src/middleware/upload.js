import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload folder exists
const uploadDir = path.join(process.cwd(), "uploads/products");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, `${Date.now()}_${file.originalname}`)
});

// Export multer instance
const upload = multer({ storage });

export default upload;
