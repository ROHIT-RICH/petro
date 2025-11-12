import jwt from "jsonwebtoken";
import User from "../models/User.js"; // optional: if you want to fetch user from DB

/**
 * ✅ Auth middleware
 * @param {Array|string} roles - Optional roles to restrict access
 * Example:
 *   auth()           -> any logged-in user
 *   auth(['admin'])  -> only admin users
 */
export const auth = (roles = []) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

      if (!token) return res.status(401).json({ message: "No token provided" });

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      // Optional: Fetch user from DB
      const user = await User.findById(decoded.id).select("-password");
      if (!user) return res.status(401).json({ message: "Unauthorized" });
      req.user = user;

      req.user = decoded; // minimal, just decoded token info

      // Role-based access
      if (allowedRoles.length && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ message: "Forbidden: insufficient permissions" });
      }

      next();
    } catch (err) {
      return res.status(401).json({ message: "Invalid token" });
    }
  };
};

/**
 * ✅ isAdmin middleware
 * Shortcut to allow only admin users
 */
export const isAdmin = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Unauthorized" });
  if (req.user.role !== "admin") {
    return res.status(403).json({ message: "Forbidden: Admin only" });
  }
  next();
};
