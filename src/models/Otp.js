import mongoose from "mongoose";

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, index: true },
    otp: { type: String, required: true },
    attempts: { type: Number, default: 0 }, // optional, to track retries
  },
  { timestamps: true } // adds createdAt & updatedAt automatically
);

// TTL index to automatically delete OTP after 5 minutes
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
