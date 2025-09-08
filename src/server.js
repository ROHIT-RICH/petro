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

dotenv.config({ path: path.join(__dirname, "../.env") });

const app = express();

// ------------------------
// 1. TRUST PROXY
// ------------------------
app.set('trust proxy', 1); // fix X-Forwarded-For error

// ------------------------
// 2. DATABASE
// ------------------------
connectDB();

// ------------------------
// 3. MIDDLEWARE
// ------------------------
app.use(express.json());

const FRONTEND = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(
  cors({
    origin: FRONTEND,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

app.use(helmet());
app.use(morgan('dev'));

// Optional: log client IP
// app.use((req, res, next) => { console.log('Client IP:', req.ip); next(); });

// ------------------------
// 4. RATE LIMIT
// ------------------------
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,
  message: "Too many requests from this IP, please try again later.",
});
app.use(generalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: "Too many login attempts, please try again later.",
});
app.use('/api/auth', authLimiter);

// ------------------------
// 5. HEALTH CHECK
// ------------------------
app.get('/', (req, res) => res.json({ ok: true, service: 'ecom-backend' }));

// ------------------------
// 6. ROUTES
// ------------------------
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/payments', paymentRoutes);

// ------------------------
// 7. NOT FOUND
// ------------------------
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));

// ------------------------
// 8. ERROR HANDLER
// ------------------------
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ message: err.message || 'Server error' });
});

// ------------------------
// 9. START SERVER
// ------------------------
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on :${PORT}`));
