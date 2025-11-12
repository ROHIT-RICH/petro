import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import crypto from "crypto"; // ✅ For generating unique referral codes

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      index: true,
    },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ["buyer", "admin"], default: "buyer" },

    // ✅ OTP fields (for phone verification)
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },

    // ✅ Referral System
    referralCode: { type: String, unique: true }, // user's own referral code
    referredBy: { type: String, default: null }, // who referred them (the referrer’s code)
    wallet: { type: Number, default: 0 }, // reward points or credits

    // ✅ Referral Stats (optional but useful)
    referralCount: { type: Number, default: 0 }, // how many people used their code
    referralEarnings: { type: Number, default: 0 }, // total earnings from referrals

    // ✅ Addresses
    addresses: [
      {
        recipientName: { type: String, required: true },
        recipientPhone: { type: String, required: true },
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    ],

    // ✅ Favorites (wishlist)
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

// ✅ Generate a unique referral code before saving new user
userSchema.pre("save", async function (next) {
  // hash password if modified
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }

  // generate referral code if not already set
  if (!this.referralCode) {
    this.referralCode = crypto
      .randomBytes(4)
      .toString("hex")
      .toUpperCase(); // e.g. “A12B9F3E”
  }

  next();
});

// ✅ Compare password
userSchema.methods.comparePassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

export default mongoose.model("User", userSchema);
