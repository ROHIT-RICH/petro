import jwt from "jsonwebtoken";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

/* ---------------------------------
   Helper: Sign JWT
--------------------------------- */
const signToken = (user) =>
  jwt.sign(
    {
      id: user._id,
      phone: user.phone,
      role: user.role,
      name: user.name,
    },
    process.env.JWT_SECRET || "secret",
    { expiresIn: "7d" }
  );

/* =========================================================
   Register (with Referral & Wallet credit)
========================================================= */
export const register = async (req, res) => {
  console.log("[REGISTER] Body:", req.body);
  try {
    const { name, email, phone, password, role, referralCode } = req.body;

    if (!name || !email || !phone || !password)
      return res.status(400).json({ success: false, message: "All fields are required" });

    const existingUser = await User.findOne({ phone });
    if (existingUser)
      return res.status(400).json({ success: false, message: "User already exists with this phone" });

    // Generate unique referral code
    let newReferralCode;
    do {
      newReferralCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    } while (await User.findOne({ referralCode: newReferralCode }));

    const newUser = new User({
      name,
      email,
      phone,
      password,
      role: role === "admin" ? "admin" : "buyer",
      referralCode: newReferralCode,
      referredBy: referralCode || null,
      wallet: 0,
    });

    // Handle referral reward
    let referrerReward = 0;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referrer.wallet += 50; // credit reward
        await referrer.save();
        referrerReward = 50;
        console.log(`[REGISTER] Rewarded ₹${referrerReward} to referrer ${referrer.phone}`);
      }
    }

    await newUser.save();

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      user: {
        id: newUser._id,
        name: newUser.name,
        phone: newUser.phone,
        wallet: newUser.wallet,
      },
      referralCode: newReferralCode,
      referrerReward,
    });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};


/* =========================================================
   Send OTP
========================================================= */
export const sendOTP = async (req, res) => {
  console.log("[SEND OTP] Request body:", req.body);
  try {
    const { phone } = req.body;
    if (!phone) {
      console.warn("[SEND OTP] Phone number missing");
      return res.status(400).json({ success: false, message: "Phone number is required" });
    }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
        name: "New User",
        email: `${phone}@temp.com`,
        phone,
        password: "dummy12345",
        role: "buyer",
        wallet: 0,
      });
      console.log("[SEND OTP] Temporary user created:", phone);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 5 * 60 * 1000;

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    console.log(`📱 OTP for ${phone}: ${otp} (expires in 5 min)`);

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully (check console)",
    });
  } catch (err) {
    console.error("[SEND OTP] Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/* =========================================================
   Verify OTP
========================================================= */
export const verifyOTP = async (req, res) => {
  console.log("[VERIFY OTP] Request body:", req.body);
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      console.warn("[VERIFY OTP] Phone or OTP missing");
      return res.status(400).json({ success: false, message: "Phone and OTP are required" });
    }

    const user = await User.findOne({ phone });
    if (!user) {
      console.warn("[VERIFY OTP] User not found:", phone);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (!user.otp || !user.otpExpires) {
      console.warn("[VERIFY OTP] No OTP requested for this number:", phone);
      return res.status(400).json({ success: false, message: "No OTP requested for this number" });
    }

    if (user.otp !== otp) {
      console.warn("[VERIFY OTP] Invalid OTP entered:", otp);
      return res.status(400).json({ success: false, message: "Invalid OTP" });
    }

    if (Date.now() > user.otpExpires) {
      console.warn("[VERIFY OTP] OTP expired for user:", phone);
      return res.status(400).json({ success: false, message: "OTP expired" });
    }

    user.otp = null;
    user.otpExpires = null;
    await user.save();
    console.log("[VERIFY OTP] OTP verified for user:", phone);

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      token,
      user: {
        id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
      },
    });
  } catch (err) {
    console.error("[VERIFY OTP] Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
/* =========================================================
   Login via email/password
========================================================= */
export const login = async (req, res) => {
  try {
    let { emailOrPhone, password } = req.body;
    emailOrPhone = emailOrPhone?.trim();
    password = password?.trim();

    if (!emailOrPhone || !password) return res.status(400).json({ success: false, message: "Email/Phone and Password required" });

    const user = await User.findOne({ $or: [{ email: emailOrPhone }, { phone: emailOrPhone }] });
    if (!user) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ success: false, message: "Invalid credentials" });

    const token = signToken(user);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        addresses: user.addresses || [],
        favorites: user.favorites || [],
      },
    });
  } catch (err) {
    console.error("[LOGIN] Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};



/* =========================================================
   Update Profile
========================================================= */
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;

    if (req.body.password) user.password = await bcrypt.hash(req.body.password, 10);

    if (Array.isArray(req.body.addresses)) {
      user.addresses = req.body.addresses.map((a) => ({
        recipientName: a.recipientName?.trim() || "",
        recipientPhone: a.recipientPhone?.trim() || "",
        line1: a.line1?.trim() || "",
        line2: a.line2?.trim() || "",
        city: a.city?.trim() || "",
        state: a.state?.trim() || "",
        postalCode: a.postalCode?.trim() || "",
        country: a.country?.trim() || "India",
        isDefault: !!a.isDefault,
      }));
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        wallet: user.wallet,
        referralCode: user.referralCode,
        referredBy: user.referredBy,
        addresses: user.addresses || [],
        favorites: user.favorites || [],
      },
    });
  } catch (err) {
    console.error("[UPDATE PROFILE] Error:", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/* =========================================================
   GENERATE REFERRAL LINK
========================================================= */
export const generateReferralLink = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const referralLink = `${process.env.CLIENT_URL}/signup?ref=${user.referralCode}`;

    return res.status(200).json({
      success: true,
      referralLink,
      message: "Referral link generated successfully",
    });
  } catch (err) {
    console.error("[GENERATE REFERRAL LINK ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/* =========================================================
   GET REFERRAL STATS
========================================================= */
export const getReferralStats = async (req, res) => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user)
      return res.status(404).json({ success: false, message: "User not found" });

    const referrals = await User.find({ referredBy: user.referralCode });
    return res.status(200).json({
      success: true,
      totalReferrals: referrals.length,
      referrals: referrals.map((r) => ({
        name: r.name,
        phone: r.phone,
        wallet: r.wallet,
      })),
    });
  } catch (err) {
    console.error("[GET REFERRAL STATS ERROR]", err);
    return res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};
