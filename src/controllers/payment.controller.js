import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Payment from "../models/Payment.js";
import Cart from "../models/Cart.js";
import Coupon from "../models/Coupon.js"; // ✅ Added

dotenv.config();

const razorpay =
  process.env.RAZORPAY_KEY && process.env.RAZORPAY_KEY_SECRET
    ? new Razorpay({
        key_id: process.env.RAZORPAY_KEY,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      })
    : null;

if (razorpay) console.log("✅ Razorpay initialized in LIVE mode");
else console.warn("⚠️ Razorpay not initialized — running in MOCK mode");

/** ---------------------------
 * 1️⃣ Create Razorpay Order (Uses Discounted Total)
 ----------------------------*/
export const createOnlinePaymentOrder = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    // ✅ Use discounted total
    const totalAmount = Math.max(order.total - (order.discount || 0), 0);
    const amountInPaise = Math.round(totalAmount * 100);

    const rzpOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      notes: { orderId },
    });

    let payment = await Payment.findOne({ order: order._id, mode: "online" });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        mode: "online",
        gateway: "razorpay",
        status: "pending",
        amount: totalAmount,
        transactionId: rzpOrder.id,
      });
    } else {
      payment.transactionId = rzpOrder.id;
      payment.status = "pending";
      payment.amount = totalAmount;
    }
    await payment.save();

    res.json({
      success: true,
      rzpOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: process.env.RAZORPAY_KEY,
      discountedTotal: totalAmount,
    });
  } catch (err) {
    console.error("Razorpay order creation failed:", err);
    res.status(500).json({
      success: false,
      message: "Payment order creation failed",
      error: err.message,
    });
  }
};

/** ---------------------------
 * 2️⃣ Verify Razorpay Payment + Mark Coupon Used
 ----------------------------*/
export const verifyOnlinePayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      orderId,
    } = req.body;

    const sign = `${razorpay_order_id}|${razorpay_payment_id}`;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(sign)
      .digest("hex");

    if (razorpay_signature !== expectedSign)
      return res
        .status(400)
        .json({ success: false, message: "Payment verification failed" });

    const order = await Order.findById(orderId);
    if (!order)
      return res.status(404).json({ success: false, message: "Order not found" });

    let payment = await Payment.findOne({ order: order._id, mode: "online" });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        mode: "online",
        gateway: "razorpay",
        status: "success",
        amount: order.total,
        transactionId: razorpay_payment_id,
        signature: razorpay_signature,
      });
    } else {
      payment.status = "success";
      payment.transactionId = razorpay_payment_id;
      payment.signature = razorpay_signature;
    }
    await payment.save();

    // ✅ Update order after payment
    order.payment = payment._id;
    order.status = "processing";
    await order.save();

    // ✅ Mark coupon as used if applied
    if (order.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: order.couponCode },
        {
          $push: { usedBy: { userId: order.user, orderId: order._id } },
          $inc: { usageCount: 1 },
        },
        { new: true }
      );
      console.log(`🎟️ Coupon ${order.couponCode} marked as used`);
    }

    // ✅ Clear user cart after successful payment
    if (order.user) {
      await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });
    }

    res.json({ success: true, message: "Payment verified successfully" });
  } catch (err) {
    console.error("Payment verification failed:", err);
    res.status(500).json({ success: false, message: "Payment verification error" });
  }
};

/** ---------------------------
 * 3️⃣ Razorpay Webhook (unchanged, added coupon logic)
 ----------------------------*/
export const handleOnlineWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const digest = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (digest !== signature) {
      console.warn("❌ Invalid webhook signature:", signature);
      return res.status(400).json({ message: "Invalid webhook signature" });
    }

    const event = req.body.event;
    const entity = req.body.payload?.payment?.entity;
    const orderEntity = req.body.payload?.order?.entity;

    console.log("🔔 Razorpay Webhook Event Received:", event);

    if (event === "payment.captured") {
      const payment = await Payment.findOne({ transactionId: entity.order_id });
      if (payment) {
        payment.status = "success";
        payment.transactionId = entity.id;
        await payment.save();

        const order = await Order.findByIdAndUpdate(
          payment.order,
          { status: "processing", payment: payment._id },
          { new: true }
        );

        // ✅ Mark coupon used (if any)
        if (order?.couponCode) {
          await Coupon.findOneAndUpdate(
            { code: order.couponCode },
            {
              $push: { usedBy: { userId: order.user, orderId: order._id } },
              $inc: { usageCount: 1 },
            }
          );
        }

        if (order?.user)
          await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });

        console.log(`✅ Payment ${payment._id} captured, order ${order._id} updated`);
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    res.status(500).json({ message: "Webhook processing failed" });
  }
};

/** ---------------------------
 * 4️⃣ COD Payment (disabled)
 ----------------------------*/
export const updateCodPayment = async (req, res) => {
  res.status(403).json({
    success: false,
    message:
      "Cash on Delivery is currently unavailable. Please use Online Payment.",
  });
};

/** ---------------------------
 * 5️⃣ Admin: Get all payments
 ----------------------------*/
export const allPayments = async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate({
        path: "order",
        select: "user customer address total discount couponCode status createdAt",
        populate: { path: "user", select: "name email phone" },
      })
      .sort("-createdAt");
    res.json(payments);
  } catch (err) {
    console.error("Fetching all payments failed:", err);
    res.status(500).json({ message: "Failed to fetch payments" });
  }
};

/** ---------------------------
 * 6️⃣ Get payment by orderId
 ----------------------------*/
export const getPaymentByOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({ order: orderId }).populate("order");

    if (!payment) return res.status(404).json({ message: "Payment not found" });
    res.json(payment);
  } catch (err) {
    console.error("Get payment by order failed:", err);
    res.status(500).json({ message: "Failed to fetch payment details" });
  }
};

/** ---------------------------
 * 7️⃣ Manual Mark Online Payment Success
 ----------------------------*/
export const updateOnlinePayment = async (req, res) => {
  try {
    const { orderId } = req.params;
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ message: "Order not found" });

    let payment = await Payment.findOne({ order: order._id, mode: "online" });
    if (!payment) {
      payment = new Payment({
        order: order._id,
        mode: "online",
        gateway: "razorpay",
        status: "success",
        amount: order.total,
      });
      await payment.save();
    } else {
      payment.status = "success";
      await payment.save();
    }

    order.payment = payment._id;
    order.status = "processing";
    await order.save();

    // ✅ Mark coupon used if applicable
    if (order.couponCode) {
      await Coupon.findOneAndUpdate(
        { code: order.couponCode },
        {
          $push: { usedBy: { userId: order.user, orderId: order._id } },
          $inc: { usageCount: 1 },
        }
      );
    }

    if (order?.user)
      await Cart.findOneAndUpdate({ user: order.user }, { $set: { items: [] } });

    res.json({ success: true, message: "Online payment recorded", payment });
  } catch (err) {
    console.error("Update online payment failed:", err);
    res.status(500).json({ message: "Online payment update failed" });
  }
};
