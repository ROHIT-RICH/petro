import jwt from "jsonwebtoken";
import User from "../models/User.js";

const signToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email, role: user.role, name: user.name, phone: user.phone, address: user.addresses },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
};

export const register = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: "Email already in use" });

    const user = await User.create({
      name,
      email,
      phone,
      password,
      role: role === "admin" ? "admin" : "buyer",
    });

    const token = signToken(user);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role },
    });
  } catch (e) {
    console.error("Register error:", e);
    res.status(500).json({ message: e.message });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });
    const ok = await user.comparePassword(password);
    if (!ok) return res.status(400).json({ message: "Invalid credentials" });

    const token = signToken(user);
    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, address: user.addresses },
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

// Helper to normalize/validate address objects including recipient fields
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

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Basic fields (unchanged unless explicitly provided)
    user.name = req.body.name ?? user.name;
    user.email = req.body.email ?? user.email;
    if (req.body.password) user.password = req.body.password;

    // Addresses: accept full replacement array; normalize and validate
    if (Array.isArray(req.body.addresses)) {
      const incoming = req.body.addresses.map(normalizeAddress);
      for (const a of incoming) {
        const err = validateAddress(a);
        if (err) return res.status(400).json({ message: err });
      }

      // Ensure only one default if multiple marked
      const hasDefault = incoming.some((a) => a.isDefault);
      if (!hasDefault && incoming.length > 0) {
        incoming.isDefault = true; // FIX: index into array
      } else if (hasDefault) {
        let marked = false;
        for (const a of incoming) {
          if (a.isDefault) {
            if (!marked) marked = true;
            else a.isDefault = false;
          }
        }
      }

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
    res.status(500).json({ message: "Server error" });
  }
};
