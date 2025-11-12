import { Router } from "express";
import { auth } from "../middleware/auth.js";
import {
  createPendingOrder,   // Stage 1: save order as pending
  myOrders,
  allOrders,
  updateOrderStatus,
  cancelOrder,
  getOrderById,         // fetch single order
} from "../controllers/order.controller.js";
import { verifyOnlinePayment } from "../controllers/payment.controller.js"; // Stage 2: finalize order

const router = Router();

// ----------------------------
// Buyer/Admin creates a pending order (Stage 1)
// ----------------------------
router.post("/", auth(["buyer", "admin"]), createPendingOrder);

// ----------------------------
// Buyer/Admin verifies payment & finalize order (Stage 2)
// ----------------------------
router.post("/verify", auth(["buyer", "admin"]), verifyOnlinePayment);

// ----------------------------
// Buyer views their own orders
// ----------------------------
router.get("/me", auth(["buyer", "admin"]), myOrders);

// ----------------------------
// Fetch single order by ID (owner or admin only)
// ----------------------------
router.get("/:id", auth(["buyer", "admin"]), getOrderById);

// ----------------------------
// Admin-only endpoints
// ----------------------------
router.get("/", auth(["admin"]), allOrders);
router.put("/:id/status", auth(["admin"]), updateOrderStatus);

// ----------------------------
// Buyer cancels their order (if pending/processing)
// ----------------------------
router.patch("/:id/cancel", auth(["buyer", "admin"]), cancelOrder);

export default router;
