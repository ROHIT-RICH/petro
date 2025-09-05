import { Router } from "express";
import Order from "../models/Order.js";
import { auth } from "../middleware/auth.js";
import {
  createPendingOrder,   // 🔹 Stage 1 (only saves order + payment = pending)
  myOrders,
  allOrders,
  updateOrderStatus,
  cancelOrder,
} from "../controllers/order.controller.js";
import { verifyOnlinePayment } from "../controllers/payment.controller.js"; // 🔹 Stage 2
// (move verify logic here if needed)

const router = Router();

// 🔹 Buyer/Admin create a pending order (no stock deduction, no cart clear yet)
router.post("/", auth(["buyer", "admin"]), createPendingOrder);

// 🔹 Buyer/Admin verify payment & finalize (stock deduct + cart clear)
router.post("/verify", auth(["buyer", "admin"]), verifyOnlinePayment);

// 🔹 Buyer can view their orders
router.get("/me", auth(["buyer", "admin"]), myOrders);

// 🔹 Get one order by ID (owner or admin only)
router.get("/:id", auth(["buyer", "admin"]), async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id).populate("payment");
    if (!order) return res.status(404).json({ message: "Not found" });

    // enforce ownership unless admin
    if (req.user.role !== "admin" && String(order.user) !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    res.json(order);
  } catch (e) {
    next(e);
  }
});

// 🔹 Admin-only management
router.get("/", auth(["admin"]), allOrders);
router.put("/:id/status", auth(["admin"]), updateOrderStatus);

// 🔹 Buyer can cancel their order (if pending/processing)
router.patch("/:id/cancel", auth(["buyer", "admin"]), cancelOrder);

export default router;
