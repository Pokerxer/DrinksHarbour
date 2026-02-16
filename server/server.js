// server.js (or index.js)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB, disconnectDB } = require('./config/db');

// Route imports
const orderRoutes = require('./routes/order.routes');
const productRoutes = require('./routes/product.routes');
const bannerRoutes = require('./routes/banner.routes');
const userRoutes = require('./routes/user.routes');
const couponRoutes = require('./routes/coupon.routes');
const cartRoutes = require('./routes/cart.routes');
const paymentRoutes = require('./routes/payment.routes');
const addressRoutes = require('./routes/address.routes');
const promoRoutes = require('./routes/promo.routes');
const saleRoutes = require('./routes/sale.routes');
const categoryRoutes = require('./routes/category.routes');
const brandRoutes = require('./routes/brand.routes');
const verificationRoutes = require('./routes/verification.routes');
const uploadRoutes = require('./routes/upload.routes');
const geminiRoutes = require('./routes/gemini.routes');
const subcategoryRoutes = require('./routes/subcategory.routes');
const wishlistRoutes = require('./routes/wishlist.routes');
const subproductRoutes = require('./routes/subproduct.routes');

const app = express();
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// ────────────────────────────────────────────────
// CORS Configuration
// ────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || isProduction) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-tenant-id',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

// ────────────────────────────────────────────────
// Request Logger
// ────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`\n🔵 ${req.method} ${req.originalUrl}`);
  console.log(`   Origin: ${req.headers.origin || 'No origin'}`);
  next();
});

// ────────────────────────────────────────────────
// Security & Performance Middleware
// ────────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://res.cloudinary.com'],
      },
    },
  })
);

app.use(compression());

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ────────────────────────────────────────────────
// Rate Limiting
// ────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isProduction ? 100 : 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => {
    return req.path === '/health' || req.path === '/api/ping';
  },
});
app.use('/api', limiter);

// ────────────────────────────────────────────────
// Mount Routes (MUST be after body parser)
// ────────────────────────────────────────────────
app.use('/api/orders', orderRoutes);
app.use('/api/products', productRoutes);
app.use('/api/banners', bannerRoutes);
app.use('/api/users', userRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/cart', cartRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/addresses', addressRoutes);
app.use('/api/promos', promoRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/brands', brandRoutes);
app.use('/api/verifications', verificationRoutes);
app.use('/api/uploads', uploadRoutes);
app.use('/api/gemini', geminiRoutes);
app.use('/api/subcategories', subcategoryRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/subproducts', subproductRoutes);

// ────────────────────────────────────────────────
// Health Check Endpoint
// ────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    mongodb: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
  });
});

// ────────────────────────────────────────────────
// File System Error Handler
// ────────────────────────────────────────────────
process.on('uncaughtException', (err) => {
  if (err.code === 'ENOENT' || err.code === 'EACCES') {
    if (err.path && err.path.includes('screenshot')) {
      return;
    }
  }
  console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// ────────────────────────────────────────────────
// 404 Handler (MUST be after all routes)
// ────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health',
      'GET /api/ping',
      'POST /api/test',
      'POST /api/users/register',
      'POST /api/users/login',
      'GET /api/products',
      'GET /api/banners',
      'GET /api/brands',
      'GET /api/coupons',
      'POST /api/payments/stripe/initialize',
      'POST /api/payments/paystack/initialize',
      'GET /api/payments/paystack/verify/:reference',
    ],
  });
});

// ────────────────────────────────────────────────
// Global Error Handler
// ────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('\n❌ ERROR CAUGHT:');
  console.error('   Message:', err.message);
  console.error('   Status:', err.status || err.statusCode || 500);
  console.error('   Path:', req.originalUrl);
  console.error('   Method:', req.method);

  if (!isProduction) {
    console.error('   Stack:', err.stack);
  }

  const statusCode = err.statusCode || err.status || 500;
  const isProd = process.env.NODE_ENV === 'production';

  res.status(statusCode).json({
    success: false,
    message: isProd && statusCode === 500 ? 'Internal server error' : err.message,
    ...(isProd ? {} : { stack: err.stack?.split('\n').slice(0, 10) }),
  });
});

// ────────────────────────────────────────────────
// Server Startup + Graceful Shutdown
// ────────────────────────────────────────────────
async function startServer() {
  try {
    await connectDB();

    console.log('\n┌──────────────────────────────────────────────────────┐');
    console.log('│              DrinksHarbour Backend API               │');
    console.log('└──────────────────────────────────────────────────────┘');
    console.log(`   Environment: ${(process.env.NODE_ENV || 'development').toUpperCase()}`);
    console.log(`   Port:        ${PORT}`);
    console.log(`   MongoDB:     ${mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   CORS:        Enabled`);
    console.log('');
    console.log('📍 Available Routes:');
    console.log('   GET  /health');
    console.log('   GET  /api/ping');
    console.log('   POST /api/test');
    console.log('   POST /api/users/register');
    console.log('   POST /api/users/login');
    console.log('   GET  /api/products');
    console.log('   GET  /api/banners');
    console.log('   GET  /api/brands');
    console.log('   GET  /api/coupons');
    console.log('   POST /api/payments/stripe/initialize');
    console.log('   POST /api/payments/paystack/initialize');
    console.log('   GET  /api/payments/paystack/verify/:reference');
    console.log('');

    const server = app.listen(PORT, () => {
      console.log(`✅ Server running on http://localhost:${PORT}`);
      console.log('   Press Ctrl+C to stop\n');
    });

    // Graceful shutdown
    const gracefulShutdown = async (signal) => {
      console.log(`\n⚠️  ${signal} received. Initiating graceful shutdown...`);

      server.close(async () => {
        console.log('   → HTTP server closed');
        await disconnectDB();
        console.log('   → Database disconnected');
        console.log('✅ Graceful shutdown complete\n');
        process.exit(0);
      });

      // Force exit after 10 seconds if cleanup hangs
      setTimeout(() => {
        console.error('❌ Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (err) => {
      console.error('❌ UNCAUGHT EXCEPTION! Shutting down...');
      console.error(err.name, err.message);
      console.error(err.stack);
      process.exit(1);
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('❌ UNHANDLED REJECTION! Shutting down...');
      console.error(err);
      server.close(() => {
        process.exit(1);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start server:', err);
    await disconnectDB().catch(console.error);
    process.exit(1);
  }
}

// Start the server
startServer();
