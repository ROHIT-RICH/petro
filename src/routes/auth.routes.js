// src/routes/auth.routes.js
import express from "express";
import {
  register,
  login,
  updateProfile,
  sendOTP,
  verifyOTP,
  getReferralStats,   // New controller to get referral info
  generateReferralLink, // Optional route to generate referral link
} from "../controllers/auth.controller.js";

import { auth } from "../middleware/auth.js"; // Updated middleware import

const router = express.Router();

// -------------------------
// 🔹 OTP Routes
// -------------------------
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);

// -------------------------
// 🔹 Authentication Routes
// -------------------------
router.post("/register", register); // supports referral code
router.post("/login", login);

// -------------------------
// 🔹 Protected Routes (Require Auth)
// -------------------------
router.put("/update-profile", auth(), updateProfile);

// -------------------------
// 🔹 Referral & Wallet Routes (Require Auth)
// -------------------------
router.get("/referral-stats", auth(), getReferralStats);   
router.get("/generate-referral-link", auth(), generateReferralLink); 

export default router;

