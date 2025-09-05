import Cart from '../models/Cart.js';
import Product from '../models/Product.js';

// Ensure the user has a cart
const ensureCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });
  return cart;
};

// Get the user's cart
export const getCart = async (req, res) => {
  const cart = await ensureCart(req.user.id);
  await cart.populate('items.product');
  res.json(cart);
};

// Add product to cart
export const addToCart = async (req, res) => {
  const { productId, quantity = 1 } = req.body;
  const product = await Product.findById(productId);
  if (!product) return res.status(404).json({ message: 'Product not found' });

  const cart = await ensureCart(req.user.id);
  const idx = cart.items.findIndex(i => i.product.equals(productId));
  if (idx > -1) {
    cart.items[idx].quantity += quantity;
  } else {
    cart.items.push({ product: productId, quantity });
  }

  await cart.save();
  await cart.populate('items.product');
  res.status(201).json(cart);
};

// Update quantity of a specific product in cart
export const updateCartItem = async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;
  if (!quantity || quantity < 1)
    return res.status(400).json({ message: 'Quantity must be at least 1' });

  const cart = await ensureCart(req.user.id);
  const idx = cart.items.findIndex(i => i.product.equals(productId));
  if (idx === -1) return res.status(404).json({ message: 'Product not in cart' });

  cart.items[idx].quantity = quantity;
  await cart.save();
  await cart.populate('items.product');
  res.json(cart);
};

// Remove a product from cart
export const removeFromCart = async (req, res) => {
  const { productId } = req.params;
  const cart = await ensureCart(req.user.id);
  cart.items = cart.items.filter(i => !i.product.equals(productId));
  await cart.save();
  await cart.populate('items.product');
  res.json(cart);
};

// Clear the cart
export const clearCart = async (req, res) => {
  const cart = await ensureCart(req.user.id);
  cart.items = [];
  await cart.save();
  await cart.populate("items.product"); // keep response consistent
  res.json(cart); // { items: [] }
};