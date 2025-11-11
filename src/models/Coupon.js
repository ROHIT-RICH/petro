// models/Coupon.js
import mongoose from "mongoose";

const { Schema } = mongoose;

/* ----------------------------------------------------
 ✅ Sub-schema: Track usage per user
---------------------------------------------------- */
const UsedBySchema = new Schema({
  userId: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  orderId: {
    type: Schema.Types.ObjectId,
    ref: "Order",
    default: null,
  },
  usedAt: {
    type: Date,
    default: Date.now,
  },
});

/* ----------------------------------------------------
 ✅ Coupon Schema (Nykaa-style)
---------------------------------------------------- */
const CouponSchema = new Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    /* ✅ Supported Types */
    type: {
      type: String,
      enum: ["percent", "flat", "free_shipping"],
      required: true,
    },

    /* ✅ For percent & flat discount */
    value: {
      type: Number,
      required: function () {
        return this.type !== "free_shipping";
      },
      min: 0,
    },

    description: {
      type: String,
      trim: true,
    },

    /* ✅ Minimum cart amount required to apply coupon */
    minCartValue: {
      type: Number,
      default: 0,
    },

    /* ✅ Validity Window */
    startDate: {
      type: Date,
      default: Date.now,
    },

    expiryDate: {
      type: Date,
      required: true,
    },

    /* ✅ Usage Limitation */
    maxUses: {
      type: Number,
      default: 0, // 0 = unlimited
    },

    maxUsesPerUser: {
      type: Number,
      default: 1,
    },

    uses: {
      type: Number,
      default: 0,
    },

    usedBy: [UsedBySchema],

    /* ✅ Status */
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    /* ✅ Creator admin/user */
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

/* ----------------------------------------------------
 ✅ Auto-deactivate expired coupons BEFORE SAVE
---------------------------------------------------- */
CouponSchema.pre("save", function (next) {
  if (this.expiryDate && new Date() > this.expiryDate) {
    this.status = "inactive";
  }
  next();
});

/* ----------------------------------------------------
 ✅ Export Model
---------------------------------------------------- */
const Coupon = mongoose.model("Coupon", CouponSchema);
export default Coupon;
