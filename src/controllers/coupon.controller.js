import Coupon from "../models/Coupon.js";
import User from "../models/User.js";

/**
 * Apply a coupon during checkout (deducts from total)
 */
export const applyCouponAtCheckout = async (req, res) => {
  try {
    console.log("🧾 [APPLY COUPON AT CHECKOUT] Body:", req.body);

    const { code, cartTotal } = req.body;
    const userId = req.user?.id;

    if (!code || !cartTotal) {
      return res.status(400).json({
        success: false,
        message: "Coupon code and cart total are required",
      });
    }

    // Find coupon
    const coupon = await Coupon.findOne({ code: code.toUpperCase() });
    console.log("📄 [COUPON FOUND]:", coupon);

    if (!coupon) {
      return res.status(404).json({ success: false, message: "Invalid coupon code" });
    }

    // Check if active
    if (coupon.status !== "active") {
      return res.status(400).json({ success: false, message: "Coupon is inactive" });
    }

    // Check date validity
    if (coupon.expiryDate && coupon.expiryDate < new Date()) {
      return res.status(400).json({ success: false, message: "Coupon has expired" });
    }

    if (coupon.startDate && new Date() < coupon.startDate) {
      return res.status(400).json({ success: false, message: "Coupon not active yet" });
    }

    // Check minimum cart value
    if (coupon.minCartValue && cartTotal < coupon.minCartValue) {
      return res.status(400).json({
        success: false,
        message: `Cart value must be at least ₹${coupon.minCartValue} to use this coupon.`,
      });
    }

    // Check if user already used
    const alreadyUsed = coupon.usedBy?.some(
      (entry) => entry.userId?.toString() === userId
    );
    if (alreadyUsed) {
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon",
      });
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === "percent") {
      discount = (cartTotal * coupon.value) / 100;
    } else if (coupon.type === "flat") {
      discount = coupon.value;
    }

    const finalAmount = Math.max(cartTotal - discount, 0);

    console.log(
      `💰 Coupon Applied: ${coupon.code} | Discount: ₹${discount} | Payable: ₹${finalAmount}`
    );

    // (Optional) Mark coupon as used after order confirmation, not right now
    // coupon.usedBy.push({ userId, usedAt: new Date() });
    // coupon.uses = (coupon.uses || 0) + 1;
    // await coupon.save();

    return res.status(200).json({
      success: true,
      message: `Coupon applied successfully! You saved ₹${discount}.`,
      discount,
      payableAmount: finalAmount,
    });
  } catch (err) {
    console.error("🔥 [APPLY COUPON ERROR]", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
  }
};

/**
 * 🔄 Convert wallet amount into a coupon
 */
export const convertWalletToCoupon = async (req, res) => {
  try {
    const { amount } = req.body;
    const userId = req.user.id;

    console.log("🟢 [Wallet→Coupon] Request received:");
    console.log("📩 Request Body:", req.body);
    console.log("👤 User ID from token:", userId);

    // 🔹 Validate amount
    if (!amount || amount <= 0) {
      console.warn("⚠️ Invalid amount received:", amount);
      return res.status(400).json({ success: false, message: "Invalid amount" });
    }

    // 🔹 Fetch user
    const user = await User.findById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    console.log("👤 User found:", { name: user.name, wallet: user.wallet });

    // 🔹 Check wallet balance
    if (user.wallet < amount) {
      console.warn("🚫 Insufficient wallet balance:", {
        userWallet: user.wallet,
        requestedAmount: amount,
      });
      return res.status(400).json({ success: false, message: "Insufficient wallet balance" });
    }

    // 🔹 Deduct amount from wallet
    console.log(`💰 Deducting ₹${amount} from wallet...`);
    user.wallet -= amount;
    await user.save();
    console.log("✅ Wallet updated. New balance:", user.wallet);

    // 🔹 Generate coupon code
    const code = `WALLET${Math.floor(1000 + Math.random() * 9000)}`;
    console.log("🎟️ Generated Coupon Code:", code);

    // 🔹 Create coupon in DB
    const coupon = await Coupon.create({
      code,
      type: "flat",
      value: amount,
      description: `Wallet converted coupon worth ₹${amount}`,
      startDate: new Date(),
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days validity
      maxUses: 1,
      maxUsesPerUser: 1,
      createdBy: user._id,
      status: "active",
    });

    console.log("✅ Coupon created successfully:", {
      couponId: coupon._id,
      code: coupon.code,
      value: coupon.value,
      createdBy: user._id,
    });

    // 🔹 Final response
    res.status(200).json({
      success: true,
      message: `₹${amount} converted into coupon successfully!`,
      couponCode: code,
      newWallet: user.wallet,
      coupon,
    });

    console.log("🎉 [SUCCESS] Wallet→Coupon process completed for user:", user.email);
  } catch (err) {
    console.error("❌ [ERROR] Wallet to coupon conversion failed:", err);
    res.status(500).json({
      success: false,
      message: "Conversion failed",
      error: err.message,
    });
  }
};

export const getMyCoupons = async (req, res) => {
  try {
    const userId = req.user.id;
    console.log("📦 [MyCoupons] Fetching coupons for user:", userId);

    const coupons = await Coupon.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .select("code value description status expiryDate createdAt");

    if (!coupons.length) {
      return res.status(200).json({
        success: true,
        message: "No coupons created yet.",
        coupons: [],
      });
    }

    console.log(`✅ Found ${coupons.length} coupons for user ${userId}`);

    res.status(200).json({
      success: true,
      coupons,
    });
  } catch (err) {
    console.error("❌ [MyCoupons] Failed to fetch user coupons:", err);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user coupons",
      error: err.message,
    });
  }
};

// controllers/coupon.controller.js
export const validateCoupon = async (req, res) => {
  try {
    console.log("🧾 [VALIDATE COUPON] Body:", req.body);

    const { code, cartTotal } = req.body;
    const userId = req.user?.id;

    if (!code || cartTotal === undefined)
      return res.status(400).json({
        success: false,
        message: "Coupon code and cart total are required",
      });

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon)
      return res.status(404).json({
        success: false,
        message: "Invalid coupon code",
      });

    if (coupon.status !== "active")
      return res.status(400).json({
        success: false,
        message: "Coupon is inactive",
      });

    const now = new Date();

    if (coupon.expiryDate < now)
      return res.status(400).json({
        success: false,
        message: "Coupon has expired",
      });

    if (now < coupon.startDate)
      return res.status(400).json({
        success: false,
        message: "Coupon is not active yet",
      });

    if (coupon.minCartValue && cartTotal < coupon.minCartValue)
      return res.status(400).json({
        success: false,
        message: `Minimum cart value required is ₹${coupon.minCartValue}`,
      });

    const alreadyUsed = coupon.usedBy?.some(
      (entry) => entry.userId?.toString() === userId
    );

    if (alreadyUsed)
      return res.status(400).json({
        success: false,
        message: "You have already used this coupon",
      });

    // ✅ Apply discount (Nykaa Style)
    let discount = 0;

    if (coupon.type === "percent") {
      discount = (cartTotal * coupon.value) / 100;

      // ✅ Nykaa rounds UP always
      discount = Math.ceil(discount);

      // ✅ Nykaa ensures minimum ₹1
      if (discount < 1) discount = 1;
    }

    if (coupon.type === "flat") {
      discount = coupon.value;
    }

    const payableAmount = Math.max(cartTotal - discount, 0);

    console.log(
      `✅ Applied ${coupon.code} | Discount: ₹${discount} | Payable: ₹${payableAmount}`
    );

    return res.status(200).json({
      success: true,
      message: `Coupon applied successfully! You saved ₹${discount}.`,
      discount,
      payableAmount,
    });
  } catch (err) {
    console.error("🔥 [VALIDATE COUPON ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};


/**
 * ✅ Mark coupon as USED after order success
 */
export const markCouponUsed = async (req, res) => {
  try {
    const { code, orderId } = req.body;
    const userId = req.user.id;

    const coupon = await Coupon.findOne({ code });

    if (!coupon)
      return res.status(404).json({ success: false, message: "Coupon not found" });

    // Add entry
    coupon.usedBy.push({
      userId,
      orderId,
      usedAt: new Date(),
    });

    coupon.uses += 1;
    await coupon.save();

    return res.status(200).json({
      success: true,
      message: "Coupon marked as used",
    });
  } catch (err) {
    console.error("🔥 [MARK COUPON USED ERROR]", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};
