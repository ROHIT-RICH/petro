// routes/Coupon.js
import express from "express";
import {
  applyCouponAtCheckout,
  convertWalletToCoupon,
  getMyCoupons,
  markCouponUsed,
  validateCoupon
} from "../controllers/coupon.controller.js";

import Coupon from "../models/Coupon.js";
import { generateCoupon, generateBulk } from "../utils/generateCouponCode.js";
import { auth, isAdmin } from "../middleware/auth.js";

const router = express.Router();

/* --------------------------------------------------
 ✅ USER SIDE ROUTES
-------------------------------------------------- */

// Checkout coupon apply
router.post("/redeem", auth(), applyCouponAtCheckout);

// Validate coupon (CheckoutModal uses this)
router.post("/validate", auth(), validateCoupon);

// Get user-created coupons
router.get("/my-coupons", auth(), getMyCoupons);

// Convert wallet to coupon
router.post("/convert-wallet", auth(), convertWalletToCoupon);

router.post("/mark-used", auth(), markCouponUsed);


/* --------------------------------------------------
 ✅ PUBLIC: List all ACTIVE coupons (Checkout Bottom Sheet)
-------------------------------------------------- */
router.get("/active", async (req, res) => {
  try {
    const coupons = await Coupon.find({
      status: "active",
      expiryDate: { $gte: new Date() }
    }).sort({ createdAt: -1 });

    res.json({ success: true, coupons });
  } catch (err) {
    console.error("[Active Coupons Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* --------------------------------------------------
 ✅ APPLY COUPON (Legacy Route) — FIXED
-------------------------------------------------- */
router.post("/apply", auth(), async (req, res) => {
  try {
    const { code, cartTotal } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Coupon code is required." });
    }

    const coupon = await Coupon.findOne({
      code: code.toUpperCase(),
      status: "active"
    });

    if (!coupon) {
      return res.status(404).json({ message: "Invalid coupon code." });
    }

    const now = new Date();

    if (now < coupon.startDate || now > coupon.expiryDate) {
      return res.status(400).json({ message: "Coupon expired or inactive." });
    }

    if (coupon.minCartValue && cartTotal < coupon.minCartValue) {
      return res.status(400).json({
        message: `Minimum cart value ₹${coupon.minCartValue} required.`
      });
    }

    if (coupon.maxUses && coupon.uses >= coupon.maxUses) {
      return res.status(400).json({ message: "Coupon usage limit reached." });
    }

    const userUses = coupon.usedBy.filter(
      (u) => u.userId.toString() === req.user._id.toString()
    ).length;

    if (coupon.maxUsesPerUser && userUses >= coupon.maxUsesPerUser) {
      return res.status(400).json({ message: "You have already used this coupon." });
    }

    /* ✅ FIXED: use correct discount type */
    let discount = 0;

    if (coupon.type === "percent") {
      discount = (coupon.value / 100) * cartTotal;
    } else if (coupon.type === "flat") {
      discount = coupon.value;
    }

    discount = Math.min(discount, cartTotal);

    res.json({
      valid: true,
      discount: Math.round(discount),
      newTotal: cartTotal - discount,
      message: "Coupon applied successfully!"
    });

  } catch (err) {
    console.error("[Apply Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

/* --------------------------------------------------
 ✅ ADMIN ROUTES
-------------------------------------------------- */

// Create single coupon
router.post("/admin/create", auth(), isAdmin, async (req, res) => {
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

    const couponCode = (code || generateCoupon(prefix || "", 8)).toUpperCase();

    const exists = await Coupon.findOne({ code: couponCode });
    if (exists) {
      return res.status(400).json({ message: "Coupon code already exists." });
    }

    const newCoupon = await Coupon.create({
      code: couponCode,
      type,
      value,
      description,
      minCartValue: minCartValue || 0,
      startDate: startDate || Date.now(),
      expiryDate,
      maxUses: maxUses || 0,
      maxUsesPerUser: maxUsesPerUser || 1,
      createdBy: req.user._id,
    });

    res.status(201).json({ success: true, coupon: newCoupon });
  } catch (err) {
    console.error("[Create Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// GET all coupons
router.get("/admin/all", auth(), isAdmin, async (req, res) => {
  try {
    const list = await Coupon.find().sort({ createdAt: -1 });
    res.json({ success: true, coupons: list });
  } catch (err) {
    console.error("[Get Coupons Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Toggle Active / Inactive
router.put("/admin/toggle/:id", auth(), isAdmin, async (req, res) => {
  try {
    const coupon = await Coupon.findById(req.params.id);

    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    coupon.status = coupon.status === "active" ? "inactive" : "active";
    await coupon.save();

    res.json({
      success: true,
      message: `Coupon ${coupon.status}.`,
      coupon
    });
  } catch (err) {
    console.error("[Toggle Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Delete Coupon
router.delete("/admin/delete/:id", auth(), isAdmin, async (req, res) => {
  try {
    const removed = await Coupon.findByIdAndDelete(req.params.id);
    if (!removed) {
      return res.status(404).json({ message: "Coupon not found." });
    }

    res.json({ success: true, message: "Coupon deleted." });
  } catch (err) {
    console.error("[Delete Coupon Error]", err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
