import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { create, update, remove } from "../controllers/product.controller.js";
import { allOrders, updateOrderStatus } from "../controllers/order.controller.js";

const router = Router();

// Ensure only admins can access
router.use(auth(["admin"]));

// // Admin Login
// router.post("/login", adminLogin);

// Product management
router.post("/products", create);              // POST   /api/admin/products
router.patch("/products/:id", update);         // PATCH  /api/admin/products/:id
router.delete("/products/:id", remove);        // DELETE /api/admin/products/:id

// Order management
router.get("/orders", allOrders);              // GET    /api/admin/orders
router.patch("/orders/:id", updateOrderStatus);// PATCH  /api/admin/orders/:id

export default router;
