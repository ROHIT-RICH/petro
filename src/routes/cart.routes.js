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

// Update quantity of an item
router.put('/:productId', updateCartItem);

// Remove specific item
router.delete('/:productId', removeFromCart);

// Clear cart
router.delete('/clear', clearCart);

export default router;
