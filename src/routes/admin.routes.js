import { Router } from "express";
import { generateCoupon } from "../utils/generateCouponCode.js";
import Coupon from "../models/Coupon.js";
import { auth, isAdmin } from "../middleware/auth.js";

import {
  create,
  update,
  remove,
} from "../controllers/product.controller.js";

import {
  allOrders,
  updateOrderStatus,
} from "../controllers/order.controller.js";

const router = Router();

// ✅ Protect ALL admin routes
router.use(auth(), isAdmin);

/* -----------------------------------
 ✅ PRODUCT ROUTES
------------------------------------*/
router.post("/products", create);
router.patch("/products/:id", update);
router.delete("/products/:id", remove);

/* -----------------------------------
 ✅ ORDER ROUTES
------------------------------------*/
router.get("/orders", allOrders);
router.patch("/orders/:id", updateOrderStatus);

/* -----------------------------------
 ✅ COUPON ROUTES
------------------------------------*/

// ✅ Create Coupon
router.post("/create-coupon", async (req, res) => {
  try {
    const {
      code,
      prefix,
      type,
      value,
      minCartValue,
      startDate,
      expiryDate,
      maxUses,
      maxUsesPerUser,
      description,
    } = req.body;

    const CouponCode = (code || generateCoupon(prefix || "", 8)).toUpperCase();

    const existing = await Coupon.findOne({ code: CouponCode });
    if (existing) {
      return res.status(400).json({
        message: "Coupon code already exists.",
      });
    }

    const newCoupon = new Coupon({
      code: CouponCode,
      type,
      value,
      description,
      minCartValue: minCartValue || 0,
      startDate: startDate || Date.now(),
      expiryDate,
      maxUses: maxUses || 0,
      maxUsesPerUser: maxUsesPerUser || 1,
      createdBy: req.user.id,
    });

    await newCoupon.save();

    res.status(201).json({
      success: true,
      coupon: newCoupon,
    });
  } catch (err) {
    console.error("[Create Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ✅ Get all coupons
router.get("/coupons", async (req, res) => {
  try {
    const coupons = await Coupon.find().sort({ createdAt: -1 });
    res.status(200).json({ success: true, coupons });
  } catch (err) {
    console.error("[Get Coupons Error]", err);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
});
/* -----------------------------------
 ✅ DELETE COUPON
------------------------------------*/
router.delete("/coupons/:id", async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    await Coupon.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Coupon deleted successfully",
    });

  } catch (err) {
    console.error("[Delete Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});


/* -----------------------------------
 ✅ DEACTIVATE COUPON
------------------------------------*/
router.patch("/coupons/:id/deactivate", async (req, res) => {
  try {
    console.log("ID RECEIVED:", req.params.id);  
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    if (coupon.status === "inactive") {
      return res.json({
        success: true,
        message: "Coupon already inactive",
        coupon,
      });
    }

    coupon.status = "inactive";
    await coupon.save();

    res.json({
      success: true,
      message: "Coupon deactivated successfully",
      coupon,
    });
  } catch (err) {
    console.error("[Deactivate Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});
/* -----------------------------------
 ✅ ACTIVATE COUPON
------------------------------------*/
router.patch("/coupons/:id/activate", async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }

    // ✅ Already active?
    if (coupon.status === "active") {
      return res.json({
        success: true,
        message: "Coupon already active",
        coupon,
      });
    }

    // ✅ Activate now
    coupon.status = "active";
    await coupon.save();

    res.json({
      success: true,
      message: "Coupon activated successfully",
      coupon,
    });

  } catch (err) {
    console.error("[Activate Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;

