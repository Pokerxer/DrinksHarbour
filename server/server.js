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
const { resolveTenant } = require('./middleware/tenant.middleware');

// Route imports
const orderRoutes            = require('./routes/order.routes');
const cartRoutes             = require('./routes/cart.routes');
const productRoutes          = require('./routes/product.routes');
const userRoutes             = require('./routes/user.routes');
const couponRoutes           = require('./routes/coupon.routes');
const paymentRoutes          = require('./routes/payment.routes');
const addressRoutes          = require('./routes/address.routes');
const promoRoutes            = require('./routes/promo.routes');
const saleRoutes             = require('./routes/sale.routes');
const categoryRoutes         = require('./routes/category.routes');
const brandRoutes            = require('./routes/brand.routes');
const verificationRoutes     = require('./routes/verification.routes');
const uploadRoutes           = require('./routes/upload.routes');
const subcategoryRoutes      = require('./routes/subcategory.routes');
const subproductRoutes       = require('./routes/subproduct.routes');
const inventoryRoutes        = require('./routes/inventory.routes');
const warehouseRoutes        = require('./routes/warehouse.routes');
const reorderRoutes          = require('./routes/reorder.routes');
const promotionRoutes        = require('./routes/promotion.routes');
const pricelistRoutes        = require('./routes/pricelist.routes');
const vendorRoutes           = require('./routes/vendor.routes');
const stockTransferRoutes    = require('./routes/stockTransfer.routes');
const purchaseOrderRoutes    = require('./routes/purchaseOrder.routes');
const vendorBillRoutes       = require('./routes/vendorBill.routes');
const purchaseAgreementRoutes= require('./routes/purchaseAgreement.routes');
const vendorPricelistRoutes  = require('./routes/vendorPricelist.routes');
const uomConversionRoutes    = require('./routes/uomConversion.routes');
const exchangeRateRoutes     = require('./routes/exchangeRate.routes');
const shippingRoutes         = require('./routes/shipping.routes');
const analyticsRoutes        = require('./routes/analytics.routes');
const geminiRoutes           = require('./routes/gemini.routes');
const bannerGeminiRoutes     = require('./routes/banner-gemini.routes');
const bannerRoutes           = require('./routes/banner.routes');
const chatbotRoutes          = require('./routes/chatbot.routes');
const placesRoutes           = require('./routes/places.routes');
const salesOrderRoutes       = require('./routes/salesOrder.routes');
const scanRoutes             = require('./routes/scan.routes');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel edge)
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// ────────────────────────────────────────────────
// CORS Configuration
// ────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:3002',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3003',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  'http://127.0.0.1:5173',
  'https://www.drinksharbour.com',
  'https://drinksharbour.com',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow no-origin requests (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true);
    // Allow exact matches
    if (allowedOrigins.includes(origin)) return callback(null, true);
    // Allow any *.drinksharbour.com subdomain
    if (/^https:\/\/([a-z0-9-]+\.)*drinksharbour\.com$/.test(origin)) return callback(null, true);
    // Allow Vercel preview deployments for this project
    if (/^https:\/\/drinks-harbour[a-z0-9-]*\.vercel\.app$/.test(origin)) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
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
    'x-tenant-slug',
    'x-is-tenant-site',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));
app.use(resolveTenant); // Resolve tenant from x-tenant-slug header (non-blocking)

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
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many requests, please try again later.' },
  skip: (req) => req.path === '/health' || req.path === '/api/ping',
});
app.use('/api', limiter);

// Serverless cold-start guard: ensure the (cached) DB connection is live before
// any /api handler runs, since connectDB uses bufferCommands:false. Cheap after
// the first request — connectDB returns the cached connection.
app.use('/api', async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    next(err);
  }
});

// ────────────────────────────────────────────────
// Mount Routes (MUST be after body parser)
// ────────────────────────────────────────────────
app.use('/api/orders',             orderRoutes);
app.use('/api/cart',               cartRoutes);
app.use('/api/products',           productRoutes);
app.use('/api/users',              userRoutes);
app.use('/api/coupons',            couponRoutes);
app.use('/api/payments',           paymentRoutes);
app.use('/api/addresses',          addressRoutes);
app.use('/api/promos',             promoRoutes);
app.use('/api/sales',              saleRoutes);
app.use('/api/categories',         categoryRoutes);
app.use('/api/brands',             brandRoutes);
app.use('/api/verifications',      verificationRoutes);
app.use('/api/uploads',            uploadRoutes);
app.use('/api/subcategories',      subcategoryRoutes);
app.use('/api/subproducts',        subproductRoutes);
app.use('/api/inventory',          inventoryRoutes);
app.use('/api/warehouses',         warehouseRoutes);
app.use('/api/stock-transfers',    stockTransferRoutes);
app.use('/api/reorder',            reorderRoutes);
app.use('/api/promotions',         promotionRoutes);
app.use('/api/pricelists',         pricelistRoutes);
app.use('/api/meetings',           require('./routes/meeting.routes'));
app.use('/api/tasks',              require('./routes/task.routes'));
app.use('/api/vendors',            vendorRoutes);
app.use('/api/purchase-orders',    purchaseOrderRoutes);
app.use('/api/vendor-bills',       vendorBillRoutes);
app.use('/api/vendor-returns',     require('./routes/vendorReturn.routes'));
app.use('/api/purchase-agreements',purchaseAgreementRoutes);
app.use('/api/vendor-pricelists',  vendorPricelistRoutes);
app.use('/api/uom-conversions',    uomConversionRoutes);
app.use('/api/exchange-rates',     exchangeRateRoutes);
app.use('/api/shipping',           shippingRoutes);
app.use('/api/analytics',          analyticsRoutes);
app.use('/api/gemini',             geminiRoutes);
app.use('/api/banner-ai',          bannerGeminiRoutes);
app.use('/api/banners',            bannerRoutes);
app.use('/api/chatbot',            chatbotRoutes);
app.use('/api/places',             placesRoutes);
app.use('/api/tenants',            require('./routes/tenant.routes'));
app.use('/api/employees',          require('./routes/employee.routes'));
app.use('/api/contacts',           require('./routes/contact.routes'));
app.use('/api/sales-orders',       salesOrderRoutes);
app.use('/api/scan',               scanRoutes);
app.use('/api/pos',                require('./routes/pos.routes'));
app.use('/api/pos-combos',         require('./routes/posCombo.routes'));

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

// Root endpoint for API info
app.get('/', (req, res) => {
  res.json({
    name: 'DrinksHarbour API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      users: '/api/users',
      products: '/api/products',
      orders: '/api/orders',
      categories: '/api/categories',
      brands: '/api/brands',
    }
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
    const dbConnection = await connectDB();

    // Drop indexes left behind by the multi-warehouse model rewrite so migrated
    // databases self-heal (prevents "E11000 dup key … subProduct: null" on
    // warehouse creation). Best-effort; never blocks startup.
    if (dbConnection) {
      const { reconcileIndexes } = require('./config/reconcileIndexes');
      await reconcileIndexes();
    }

    // Recurring batch-expiry scan. Off during tests; on in production or when
    // ENABLE_CRON=true is set explicitly.
    if (process.env.ENABLE_CRON === 'true' || process.env.NODE_ENV === 'production') {
      const { startExpiryCron } = require('./jobs/expiryScan.job');
      startExpiryCron();
      const { startQuarantineCron } = require('./jobs/quarantineExpired.job');
      startQuarantineCron();
    }

    console.log('\n┌──────────────────────────────────────────────────────┐');
    console.log('│              DrinksHarbour Backend API               │');
    console.log('└──────────────────────────────────────────────────────┘');
    console.log(`   Environment: ${(process.env.NODE_ENV || 'development').toUpperCase()}`);
    console.log(`   Port:        ${PORT}`);
    const mongoStatus = dbConnection 
      ? (mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected')
      : '⚠️  Not configured (set MONGODB_URI in env)';
    console.log(`   MongoDB:     ${mongoStatus}`);
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

    // ── Socket.io (for cross-device scan pairing) ────────────────────────────
    // Attached only to the long-running HTTP server — the serverless export
    // (`module.exports = app` below) is unaffected. CORS reuses the same origin
    // policy as the Express app so the admin client can connect. Controllers
    // reach `io` via `req.app.get('io')` and emit to a `scan:<pairingCode>` room.
    try {
      const { Server: IoServer } = require('socket.io');
      const io = new IoServer(server, {
        cors: {
          origin: corsOptions.origin,
          methods: ['GET', 'POST'],
          credentials: true,
        },
      });
      app.set('io', io);
      console.log('   Socket.io attached (scan pairing ready)');
    } catch (err) {
      console.warn('   Socket.io not attached:', err.message);
    }

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

// Export the fully-configured Express app so serverless runtimes (Vercel)
// invoke it directly as the request handler.
module.exports = app;

// Bind a listening port only outside serverless (local dev / long-running host).
// On Vercel the platform calls the exported app; the /api guard warms the DB.
if (!process.env.VERCEL) {
  startServer();
}
