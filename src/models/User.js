import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
    addresses: [
      {
        recipientName: { type: String, required: true },   // NEW
        recipientPhone: { type: String, required: true },  // NEW
        line1: String,
        line2: String,
        city: String,
        state: String,
        postalCode: String,
        country: String,
      },
    ],
    favorites: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
  },
  { timestamps: true }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

userSchema.methods.comparePassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

export default mongoose.model("User", userSchema);
