import express from "express";
import { register, login, updateProfile } from "../controllers/auth.controller.js";
import { auth } from "../middleware/auth.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.put("/update-profile", auth(), updateProfile);

export default router;