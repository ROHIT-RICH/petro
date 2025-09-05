import { Router } from "express";
import { auth } from "../middleware/auth.js";
import { getFavorites, toggleFavorite } from "../controllers/favorites.controller.js";
const router = Router();
router.use(auth(["buyer","admin"]));
router.get("/", getFavorites);                 // GET /api/favorites
router.post("/:productId/toggle", toggleFavorite); // POST /api/favorites/:productId/toggle
export default router;