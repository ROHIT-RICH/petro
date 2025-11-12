import mongoose from "mongoose";
import Cart from "../models/Cart.js";
import Product from "../models/Product.js";

// 🔹 Attach stored variant object to cart items
const attachVariantToCart = (cart) => {
  const plain = cart.toObject();
  plain.items = plain.items.map((item) => ({
    ...item,
    variant: item.variant || null,
  }));
  return plain;
};

// 🔹 Ensure user has a cart
const ensureCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// 🔹 Get user's cart
export const getCart = async (req, res) => {
  const cart = await ensureCart(req.user.id);
  await cart.populate("items.product");
  res.json(attachVariantToCart(cart));
};

// 🔹 Add product (with selected variant) to cart
export const addToCart = async (req, res) => {
  const { productId, variantId, quantity } = req.body;

  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: "Product not found" });

  const cart = await ensureCart(req.user.id);

  let existingIndex = -1;

  if (product.variants?.length > 0) {
    if (!variantId) return res.status(400).json({ message: "variantId required" });

    const selectedVariant = product.variants.find((v) => v._id.toString() === variantId);
    if (!selectedVariant) return res.status(400).json({ message: "Variant not found" });

    // Find existing cart item
    existingIndex = cart.items.findIndex(
      (i) =>
        i.product.equals(productId) &&
        i.variantId?.toString() === variantId.toString()
    );

    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        variantId,
        variant: selectedVariant.toObject(),
        quantity,
      });
    }
  } else {
    // Product without variant
    existingIndex = cart.items.findIndex((i) => i.product.equals(productId) && !i.variantId);
    if (existingIndex > -1) {
      cart.items[existingIndex].quantity += quantity;
    } else {
      cart.items.push({
        product: productId,
        variantId: null,
        variant: null,
        quantity,
      });
    }
  }

  await cart.save();
  await cart.populate("items.product");
  res.status(201).json(attachVariantToCart(cart));
};


// 🔹 Update quantity
export const updateCartItem = async (req, res) => {
  const { productId, variantId, quantity } = req.body;

  const qty = parseInt(quantity, 10);
  if (!qty || qty < 1) {
    return res.status(400).json({ message: "Quantity must be at least 1" });
  }

  const cart = await ensureCart(req.user.id);

  const idx = cart.items.findIndex((i) => {
    if (variantId) return i.product.equals(productId) && i.variantId?.toString() === variantId.toString();
    return i.product.equals(productId) && !i.variantId;
  });

  if (idx === -1) return res.status(404).json({ message: "Product/variant not in cart" });

  cart.items[idx].quantity = qty;

  await cart.save();
  await cart.populate("items.product");

  res.json(attachVariantToCart(cart));
};

// 🔹 Remove product/variant (variantId optional)
export const removeFromCart = async (req, res) => {
  // Get from body instead of params
  const { productId, variantId } = req.body;

  const cart = await ensureCart(req.user.id);

  cart.items = cart.items.filter((i) => {
    const matchesProduct = i.product.equals(productId);
    if (variantId && variantId !== "base") {
      return !(matchesProduct && i.variantId?.toString() === variantId.toString());
    } else {
      // Handle base product
      return !(matchesProduct && !i.variantId);
    }
  });

  await cart.save();
  await cart.populate("items.product");

  res.json(attachVariantToCart(cart));
};

// 🔹 Clear cart
export const clearCart = async (req, res) => {
  const cart = await ensureCart(req.user.id);
  cart.items = [];
  await cart.save();
  await cart.populate("items.product");
  res.json(attachVariantToCart(cart));
};
