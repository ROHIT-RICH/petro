import jwt from "jsonwebtoken";
import User from "../models/User.js";

// ----------------------
// Helper: JWT Generator
// ----------------------
const signToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      address: user.addresses,
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

// ----------------------
// REGISTER
// ----------------------
export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Check for duplicate email or phone
    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ message: "Email already in use" });

    const phoneExists = await User.findOne({ phone });
    if (phoneExists) return res.status(400).json({ message: "Phone already in use" });

    // Create user
    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role === "admin" ? "admin" : "buyer",
    });

    // Sign token and return response
    const token = signToken(user);
    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: "Server error during registration" });
  }
};

// ----------------------
// LOGIN (email or phone)
// ----------------------
export const login = async (req, res) => {
  try {
    const { email, phone, password } = req.body;

    // Must have either email or phone, and password
    if ((!email && !phone) || !password) {
      return res.status(400).json({ message: "Email/Phone and Password required" });
    }

    // Find user by email OR phone
    const user = await User.findOne({
      $or: [{ email }, { phone }],
    });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const validPassword = await user.comparePassword(password);
    if (!validPassword) return res.status(400).json({ message: "Invalid credentials" });

    // Generate token and respond
    const token = signToken(user);
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        address: user.addresses,
      },
    });
  } catch (e) {
    console.error("Login error:", e);
    res.status(500).json({ message: "Server error during login" });
  }
};

// ----------------------
// ADDRESS HELPERS
// ----------------------
const normalizeAddress = (a = {}) => ({
  recipientName: String(a.recipientName || "").trim(),
  recipientPhone: String(a.recipientPhone || "").trim(),
  line1: String(a.line1 || "").trim(),
  line2: String(a.line2 || "").trim(),
  city: String(a.city || "").trim(),
  state: String(a.state || "").trim(),
  postalCode: String(a.postalCode || "").trim(),
  country: String(a.country || "India").trim(),
  isDefault: !!a.isDefault,
});

const validateAddress = (a) => {
  if (!a.recipientName) return "Recipient name is required";
  if (!/^\d{10}$/.test(a.recipientPhone)) return "Valid 10-digit recipient phone required";
  if (!a.line1) return "Address line 1 is required";
  if (!a.city) return "City is required";
  if (!a.state) return "State is required";
  if (!/^\d{5,6}$/.test(a.postalCode)) return "Valid postal code required";
  if (!a.country) return "Country is required";
  return null;
};

// ----------------------
// UPDATE PROFILE
// ----------------------
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Basic fields
    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    if (req.body.password) user.password = req.body.password;

    // Handle addresses
    if (Array.isArray(req.body.addresses)) {
      const incoming = req.body.addresses.map(normalizeAddress);

      for (const a of incoming) {
        const err = validateAddress(a);
        if (err) return res.status(400).json({ message: err });
      }

      // Ensure only one default address
      let defaultFound = false;
      incoming.forEach((addr, i) => {
        if (addr.isDefault) {
          if (defaultFound) addr.isDefault = false;
          else defaultFound = true;
        }
      });

      // If none marked default, make the first one default
      if (!defaultFound && incoming.length > 0) incoming[0].isDefault = true;

      user.addresses = incoming;
    }

    await user.save();

    res.json({
      name: user.name,
      email: user.email,
      phone: user.phone,
      addresses: user.addresses,
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error during profile update" });
  }
};
