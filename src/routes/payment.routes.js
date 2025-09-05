import { Router } from "express";
import {
  createOnlinePaymentOrder,
  verifyOnlinePayment,
  handleOnlineWebhook,
  updateCodPayment,
  updateOnlinePayment,   // new
  allPayments,
  getPaymentByOrder,
} from "../controllers/payment.controller.js";
import { auth } from "../middleware/auth.js";

const router = Router();

// 🔹 Buyer/Admin authenticated routes
router.post("/create", auth(["buyer", "admin"]), createOnlinePaymentOrder);
router.post("/verify", auth(["buyer", "admin"]), verifyOnlinePayment);
router.post("/:orderId/online", auth(["buyer", "admin"]), updateOnlinePayment);  // 🔹 NEW
router.get("/order/:orderId", auth(["buyer", "admin"]), getPaymentByOrder);

// 🔹 Admin only
router.get("/", auth(["admin"]), allPayments);
// router.patch("/:orderId/cod", auth(["admin", "buyer"]), updateCodPayment);

// 🔹 Razorpay webhook (no auth, Razorpay calls this directly)
router.post("/webhook", handleOnlineWebhook);

export default router;
