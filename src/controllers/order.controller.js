import Order from "../models/Order.js";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";
import Payment from "../models/Payment.js";

// Create order
export const createOrder = async (req, res) => {
  try {
    const { paymentId, customer, address, paymentMode, items: selectedItems } = req.body;

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    const items = [];

    // Process selected items and update stock
    await Promise.all(
      selectedItems.map(async (i) => {
        const productId = i.product._id || i.product;
        const product = await Product.findById(productId);
        if (!product) throw new Error("Invalid product in order");

        if (i.quantity > product.stock) {
          throw new Error(`Insufficient stock for ${product.title}`);
        }

        product.stock -= i.quantity;
        product.sold += i.quantity;
        await product.save();

        items.push({
          product: product._id,
          title: product.title || product.name,
          price: Number(product.price),
          quantity: Number(i.quantity),
        });
      })
    );

    // Calculate total
    const total = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    // ✅ First create order
    const order = await Order.create({
      user: req.user.id,
      items,
      total,
      status: "pending",
      customer,
      address,
    });

    // ✅ Then create payment linked to order
    const payment = await Payment.create({
      order: order._id,
      mode: "online",
      status: "pending", // COD confirmed later, online after verification
      amount: total,
      transactionId: paymentId || null,
    });

    // ✅ Link payment back to order
    order.payment = payment._id;
    await order.save();

    // Remove ordered items from cart
    const cart = await Cart.findOne({ user: req.user.id });
    if (cart) {
      cart.items = cart.items.filter(
        (cItem) =>
          !selectedItems.some(
            (sItem) =>
              String(sItem.product._id || sItem.product) === String(cItem.product)
          )
      );
      await cart.save();
    }

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error("Order failed:", err);
    res.status(400).json({ message: err.message || "Order failed" });
  }
};


// Cancel order
export const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id).populate("payment");
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status === "cancelled") {
      return res.status(400).json({ message: "Order already cancelled" });
    }

    // Restore stock
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.product },
        { $inc: { stock: item.quantity, sold: -item.quantity } }
      );
    }

    order.status = "cancelled";
    await order.save();

    // Update payment status
    if (order.payment) {
      await Payment.findByIdAndUpdate(order.payment, { status: "refunded" });
    }

    res.json({ message: "Order cancelled successfully", order });
  } catch (err) {
    console.error("Cancel failed:", err);
    res.status(400).json({ message: err.message || "Cancel failed" });
  }
};

// Get all orders (admin)
export const allOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .sort("-createdAt")
      .populate("items.product")
      .populate("user", "name email")
      .populate("paymentDetails"); // use virtual populate

    // Optional: rename for frontend compatibility
    const ordersWithPayments = orders.map(o => {
      const orderObj = o.toObject();
      orderObj.payments = orderObj.paymentDetails ? [orderObj.paymentDetails] : [];
      delete orderObj.paymentDetails;
      return orderObj;
    });

    res.json(ordersWithPayments);
  } catch (err) {
    console.error("[API] Failed to fetch orders:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};


// Get logged-in user orders
export const myOrders = async (req, res) => {
  try {
    const orders = await Order.find({ user: req.user.id })
      .sort("-createdAt")
      .populate("payment")
      .populate("items.product");

    res.json(orders);
  } catch (err) {
    console.error("Error fetching user orders:", err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// Update order status (admin only)
export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findById(id).populate("payment");
    if (!order) return res.status(404).json({ message: "Order not found" });

    // Restore stock if cancelled
    if (status === "cancelled" && order.status !== "cancelled") {
      for (const item of order.items) {
        await Product.updateOne(
          { _id: item.product },
          { $inc: { stock: item.quantity, sold: -item.quantity } }
        );
      }
      if (order.payment) {
        await Payment.findByIdAndUpdate(order.payment, { status: "refunded" });
      }
    }

    order.status = status;
    await order.save();

    res.json(order);
  } catch (err) {
    console.error("Failed to update order:", err);
    res.status(400).json({ message: err.message || "Update failed" });
  }
};

export const createPendingOrder = async (req, res) => {
  try {
    const { customer, address, items, total } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "No items selected" });
    }

    // 1️⃣ Create the Order first (pending)
    const order = await Order.create({
      user: req.user.id,
      items,
      total,
      status: "pending", // not placed yet
      customer,
      address,
    });

    // 2️⃣ DO NOT create Payment yet
    // Payment will be created after online checkout (in verifyOnlinePayment)

    res.status(201).json({ success: true, order });
  } catch (err) {
    console.error("Create pending order failed:", err);
    res.status(400).json({ message: err.message });
  }
};
