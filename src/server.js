import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from "path";
import { fileURLToPath } from "url"; 
import rateLimit from 'express-rate-limit';
import { connectDB } from './config/db.js';
import authRoutes from './routes/auth.routes.js';
import productRoutes from './routes/product.routes.js';
import cartRoutes from './routes/cart.routes.js';
import orderRoutes from './routes/order.routes.js';
import adminRoutes from './routes/admin.routes.js';
import favoriteRoutes from './routes/favorites.routes.js';
import paymentRoutes from './routes/payment.routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// console.log("Looking for .env at:", path.join(__dirname, "../.env"));
dotenv.config({ path: path.join(__dirname, "../.env") });
// console.log("Loaded ENV:", process.env.RAZORPAY_KEY, process.env.RAZORPAY_KEY_SECRET);

const app = express();

// DB
connectDB();

// Middleware
app.use(express.json());

// Explicit CORS for Vite frontend at 5173 and Bearer tokens
const FRONTEND = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: FRONTEND, // your frontend origin
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], // include PATCH
    credentials: true, // if you use cookies/auth
  })
);

// Security, logging, rate limit
app.use(helmet());
app.use(morgan('dev'));
app.use(rateLimit({ windowMs: 60 * 1000, max: 120 }));

// Health check
app.get('/', (req, res) => res.json({ ok: true, service: 'ecom-backend' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/payments', paymentRoutes);

// Not found
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
