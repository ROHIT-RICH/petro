import { Router } from "express";
import {
  list,
  getOne,
  create,
  update,
  remove,
  destroy,   // 👈 add this
  updateStock,
  getStats,
  adminList,
  uploadImages,
  removeImage,
  categories,
  brands,
} from "../controllers/product.controller.js";
import { auth } from "../middleware/auth.js";
import { upload } from "../config/cloudinary.js";

const router = Router();

// Public routes
router.get("/", list);
router.get("/stats", auth(["admin"]), getStats);
router.get("/:id", getOne);
router.get("/categories/list", categories);
router.get("/brands/list", brands);

// Admin-only routes
router.get("/admin/all", auth(["admin"]), adminList);

// Upload route (just for images)
router.post("/upload", auth(["admin"]), upload.array("images"), uploadImages);

// Remove a single image
router.post("/remove-image", auth(["admin"]), removeImage);

// Create/Update products (accept uploaded files directly)
router.post("/", auth(["admin"]), upload.array("images"), create);
router.put("/:id", auth(["admin"]), upload.array("images"), update);

// Soft delete (deactivate but keep in DB)
router.delete("/:id", auth(["admin"]), remove);

// Hard delete (permanent delete, only if no orders linked)
router.delete("/:id/destroy", auth(["admin"]), destroy);

router.put("/:id/stock", auth(["admin"]), updateStock);

export default router;
