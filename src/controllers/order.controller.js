import mongoose from "mongoose";
import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";

/** ---------------------------
 * Helper: Get stock for a product/variant
 ----------------------------*/
const getItemStock = (product, variantId) => {
  if (variantId) {
    const variant = product.variants.id(variantId);
    return variant ? variant.stock : 0;
  }
  return product.stock;
};

/** ---------------------------
 * Create confirmed order
 ----------------------------*/
export const createOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { paymentId, customer, address, paymentMode, items: selectedItems, shipping = 0 } = req.body;
    console.log("🔔 createOrder called with:", { customer, address, paymentMode, shipping, selectedItems });

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      console.log("❌ No items in request");
      return res.status(400).json({ success: false, message: "No items selected" });
    }

    const items = [];

    for (const i of selectedItems) {
      const productId = i.product._id || i.product;
      console.log("📌 Fetching product:", productId);

      const product = await Product.findById(productId).session(session);
      if (!product) throw new Error("Invalid product in order");

      let finalPrice = i.price ?? product.price;
      let variantSnapshot = null;

      if (i.variantId) {
        const variantIdObj = mongoose.Types.ObjectId.isValid(i.variantId)
          ? new mongoose.Types.ObjectId(i.variantId)
          : i.variantId;

        console.log("🟡 Variant check:", {
          productId: product._id,
          variantIdSent: i.variantId,
          variantIdNormalized: variantIdObj,
          availableVariants: product.variants.map(v => ({
            id: v._id,
            stock: v.stock,
            price: v.price,
          })),
        });

        const variant = product.variants.id(variantIdObj);
        if (!variant) throw new Error(`Invalid variant for ${product.title}`);
        finalPrice = i.price ?? variant.price;
        variantSnapshot = { ...variant.toObject(), price: finalPrice };

        console.log("✅ Variant found:", variantSnapshot);
      }

      if (i.quantity > getItemStock(product, i.variantId)) {
        throw new Error(`Insufficient stock for ${product.title}`);
      }

      // Update stock
      if (i.variantId) {
        console.log(`📉 Deducting stock from variant ${i.variantId}`);
        product.variants.id(i.variantId).stock -= i.quantity;
      } else {
        console.log("📉 Deducting stock from main product");
        product.stock -= i.quantity;
      }

      product.sold += i.quantity;
      await product.save({ session });

      const orderItem = {
        product: product._id,
        variantId: i.variantId || null,
        variant: variantSnapshot,
        title: product.title || product.name,
        price: finalPrice,
        quantity: Number(i.quantity),
        subtotal: finalPrice * i.quantity,
      };

      console.log("📦 Order item prepared:", orderItem);
      items.push(orderItem);
    }

    const total = items.reduce((sum, i) => sum + i.subtotal, 0) + Number(shipping);
    console.log("📝 Order summary:", { items, shipping, totalComputed: total });

    // Create order
    let [order] = await Order.create([{
      user: req.user.id,
      items,
      total,
      shipping,
      status: "pending",
      customer,
      address
    }], { session });

    console.log("📌 Order document created:", order._id);

    // Create payment
    const [payment] = await Payment.create([{
      order: order._id,
      mode: paymentMode || "online",
      status: paymentMode === "cod" ? "unpaid" : "pending",
      amount: total,
      transactionId: paymentId || null,
    }], { session });

    console.log("💰 Payment document created:", payment._id);

    order.payment = payment._id;
    await order.save({ session });

    // Remove items from cart
    console.log("🗑️ Removing items from cart:", selectedItems.map(s => ({
      product: s.product._id || s.product,
      variantId: s.variantId || null
    })));

    await Cart.updateOne(
      { user: req.user.id },
      {
        $pull: {
          items: {
            $or: selectedItems.map(s => ({
              product: s.product._id || s.product,
              ...(s.variantId ? { variantId: s.variantId } : {})
            }))
          }
        }
      },
      { session }
    );

    await session.commitTransaction();

    order = await Order.findById(order._id)
      .populate("user", "name email phone")
      .populate("items.product")
      .populate("paymentDetails");

    console.log("✅ Final order created successfully:", order._id);

    res.status(201).json({ success: true, data: order, message: "Order created successfully" });

  } catch (err) {
    await session.abortTransaction();
    console.error("❌ Order failed:", err);
    res.status(400).json({ success: false, message: err.message || "Order failed" });
  } finally {
    session.endSession();
  }
};


/** ---------------------------
 * Cancel order
 ----------------------------*/
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).populate("paymentDetails");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (!["pending", "processing"].includes(order.status)) {
      return res.status(400).json({ success: false, message: "Only pending/processing orders can be cancelled" });
    }

    // Restore stock
    for (const item of order.items) {
      if (item.variantId) {
        await Product.updateOne(
          { _id: item.product, "variants._id": item.variantId },
          { $inc: { "variants.$.stock": item.quantity, sold: -item.quantity } }
        );
      } else {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity, sold: -item.quantity } }
        );
      }
    }

    order.status = "cancelled";
    await order.save();

    if (order.payment) {
      await Payment.findByIdAndUpdate(order.payment, { status: "refunded" });
    }

    res.json({ success: true, data: order, message: "Order cancelled successfully" });
  } catch (err) {
    console.error("Cancel failed:", err);
    res.status(400).json({ success: false, message: err.message || "Cancel failed" });
  }
};

/** ---------------------------
 * Get all orders (admin)
 ----------------------------*/
export const allOrders = async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = status ? { status } : {};

    const orders = await Order.find(filter)
      .sort("-createdAt")
      .skip((page - 1) * limit)
      .limit(Number(limit))
      .populate("items.product")
      .populate("user", "name email phone")
      .populate("paymentDetails");

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("[API] Failed to fetch orders:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

/** ---------------------------
 * Get logged-in user orders
 ----------------------------*/
export const myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort("-createdAt")
      .populate("items.product")
      .populate("paymentDetails");

    res.json({ success: true, data: orders });
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({ success: false, message: "Failed to fetch orders" });
  }
};

/** ---------------------------
 * Get order by ID
 ----------------------------*/
export const getOrderById = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate("items.product")
      .populate("user", "name email phone")
      .populate("paymentDetails");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (req.user.role !== "admin" && String(order.user._id) !== req.user.id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    res.json({ success: true, data: order });
  } catch (err) {
    console.error("Error fetching order:", err);
    res.status(500).json({ success: false, message: "Failed to fetch order" });
  }
};

/** ---------------------------
 * Update order status (admin only)
 ----------------------------*/
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id).populate("paymentDetails");
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });

    if (order.status === "delivered" && status === "cancelled") {
      return res.status(400).json({ success: false, message: "Delivered orders cannot be cancelled" });
    }

    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.items) {
        if (item.variantId) {
          await Product.updateOne(
            { _id: item.product, "variants._id": item.variantId },
            { $inc: { "variants.$.stock": item.quantity, sold: -item.quantity } }
          );
        } else {
          await Product.updateOne(
            { _id: item.product },
            { $inc: { stock: item.quantity, sold: -item.quantity } }
          );
        }
      }
      if (order.payment) {
        await Payment.findByIdAndUpdate(order.payment, { status: "refunded" });
      }
    }

    order.status = status;
    await order.save();

    res.json({ success: true, data: order, message: "Order status updated" });
  } catch (err) {
    console.error("Failed to update order:", err);
    res.status(400).json({ success: false, message: err.message || "Update failed" });
  }
};

/** ---------------------------
 * Create pending order (online checkout)
 ----------------------------*/
export const createPendingOrder = async (req, res) => {
  try {
    const { customer, address, items: selectedItems, shipping = 0 } = req.body;
    console.log("🔔 createPendingOrder called with:", { customer, address, shipping, selectedItems });

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      console.log("❌ No items in request");
      return res.status(400).json({ success: false, message: "No items selected" });
    }

    const items = [];

    for (const i of selectedItems) {
      const productId = i.product._id || i.product;
      console.log("📌 Fetching product:", productId);

      const product = await Product.findById(productId);
      if (!product) throw new Error("Invalid product in pending order");

      let variantSnapshot = null;
      if (i.variantId) {
        const variantIdObj = mongoose.Types.ObjectId.isValid(i.variantId)
          ? new mongoose.Types.ObjectId(i.variantId)
          : i.variantId;

        console.log("🟡 Pending variant check:", {
          productId: product._id,
          variantIdSent: i.variantId,
          variantIdNormalized: variantIdObj,
          availableVariants: product.variants.map(v => ({
            id: v._id,
            stock: v.stock,
            price: v.price,
          })),
        });

        const variant = product.variants.id(variantIdObj);
        if (!variant) throw new Error(`Invalid variant for ${product.title}`);
        variantSnapshot = { ...variant.toObject(), price: i.price };

        console.log("✅ Pending variant found:", variantSnapshot);
      }

      const orderItem = {
        product: product._id,
        variantId: i.variantId || null,
        variant: variantSnapshot,
        title: product.title || product.name,
        price: i.price,
        quantity: Number(i.quantity),
        subtotal: i.price * i.quantity,
      };

      console.log("📦 Pending order item:", orderItem);
      items.push(orderItem);
    }

    const total = items.reduce((sum, i) => sum + i.subtotal, 0) + Number(shipping);
    console.log("📝 Pending order summary:", { items, shipping, totalComputed: total });

    let order = await Order.create({
      user: req.user.id,
      items,
      total,
      shipping,
      status: "pending",
      customer,
      address,
    });

    order = await Order.findById(order._id)
      .populate("user", "name email phone")
      .populate("items.product");

    console.log("✅ Pending order created successfully:", order._id);

    res.status(201).json({ success: true, data: order, message: "Pending order created" });

  } catch (err) {
    console.error("❌ Create pending order failed:", err);
    res.status(400).json({ success: false, message: err.message });
  }
};