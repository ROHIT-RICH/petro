import { Router } from 'express';
import { auth } from '../middleware/auth.js';
import {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  updateCartItem,
} from '../controllers/cart.controller.js';

const router = Router();

// Protect all cart routes
router.use(auth(['buyer', 'admin']));

// Get all cart items
router.get('/', getCart);

// Add item to cart
router.post('/add', addToCart);

// Update quantity of a specific variant
router.put('/:productId/:variantId', updateCartItem);

// Remove specific variant (variantId optional)
router.delete('/:productId/:variantId?', removeFromCart);

// Clear cart
router.delete('/clear', clearCart);

export default router;
