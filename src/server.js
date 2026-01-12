// server.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import { connectDB } from "./config/db.js";
const client = require("prom-client");

// 🧩 Import Routes (All files use *.routes.js convention)
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/product.routes.js";
import cartRoutes from "./routes/cart.routes.js";
import orderRoutes from "./routes/order.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import favoriteRoutes from "./routes/favorites.routes.js"; // Make sure the file exists
import paymentRoutes from "./routes/payment.routes.js";
import couponRoutes from "./routes/Coupon.routes.js"; // Make sure the file exists

// ------------------------
// ✅ Resolve __dirname for ES Modules
// ------------------------
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ------------------------
// ✅ Load Environment Variables
// ------------------------
dotenv.config({ path: path.join(__dirname, "../.env") });

// ------------------------
// ✅ Initialize Express App
// ------------------------
const app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

// ------------------------
// ✅ Trust Proxy
// ------------------------
app.set("trust proxy", 1);

// ------------------------
// ✅ Connect to MongoDB
// ------------------------
connectDB()
  .then(() => console.log("✅ MongoDB Connected Successfully"))
  .catch((err) => {
    console.error("❌ MongoDB Connection Error:", err.message);
    process.exit(1);
  });

// ------------------------
// ✅ Security Middlewares
// ------------------------
app.use(helmet());
app.disable("x-powered-by");

// ------------------------
// ✅ Logger
// ------------------------
app.use(morgan("dev"));

// ------------------------
// ✅ CORS Configuration
// ------------------------
const allowedOrigins = [
  "http://localhost:5173",
  "https://thepetroshop.com",
  // "https://admin.thepetroshop.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.warn(`🚫 Blocked CORS request from origin: ${origin}`);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ------------------------
// ✅ Rate Limiting
// ------------------------
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 120,
  message: {
    success: false,
    message: "Too many requests, please try again later.",
  },
});

const otpLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 2 minutes
  limit: 5,
  message: {
    success: false,
    message: "Too many OTP requests. Try again after 2 minutes.",
  },
});




app.get("/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.use("/api", apiLimiter);
app.use("/api/auth/send-otp", otpLimiter);

// ------------------------
// ✅ Health Check Route
// ------------------------
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "✅ E-Commerce Backend Running",
    environment: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// ------------------------
// ✅ API Routes
// ------------------------
app.use("/api/auth", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/favorites", favoriteRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/coupons", couponRoutes);

// ------------------------
// ✅ Serve Frontend in Production
// ------------------------
if (process.env.NODE_ENV === "production") {
  const clientPath = path.join(__dirname, "../frontend/dist");
  app.use(express.static(clientPath));

  app.get("*", (req, res) => {
    res.sendFile(path.resolve(clientPath, "index.html"));
  });
}

// ------------------------
// ✅ 404 Not Found Handler
// ------------------------
app.all("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
  });
});

// ------------------------
// ✅ Global Error Handler
// ------------------------
app.use((err, req, res, next) => {
  console.error("❌ Global Error:", err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

// ------------------------
// ✅ Start Server
// ------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT} (${process.env.NODE_ENV || "development"})`);
});
