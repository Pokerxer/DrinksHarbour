// server.js (or index.js)
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { connectDB, disconnectDB } = require('./config/db');
// resolveTenantContext is now mounted per-router after protect(), not globally.
// See route files for: router.use(protect); router.use(resolveTenantContext);

// Route imports
const orderRoutes            = require('./routes/order.routes');
const cartRoutes             = require('./routes/cart.routes');
const productRoutes          = require('./routes/product.routes');
const userRoutes             = require('./routes/user.routes');
const roleRoutes             = require('./routes/role.routes');
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
const deliveryRoutes         = require('./routes/delivery.routes');
const driverRoutes           = require('./routes/driver.routes');
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
const taxRoutes              = require('./routes/tax.routes');
const accountingRoutes       = require('./routes/accounting.routes');
const shippingRoutes         = require('./routes/shipping.routes');
const analyticsRoutes        = require('./routes/analytics.routes');
const geminiRoutes           = require('./routes/gemini.routes');
const bannerGeminiRoutes     = require('./routes/banner-gemini.routes');
const bannerRoutes           = require('./routes/banner.routes');
const reviewRoutes           = require('./routes/review.routes');
const blogRoutes             = require('./routes/blog.routes');
const chatbotRoutes          = require('./routes/chatbot.routes');
const placesRoutes           = require('./routes/places.routes');
const salesOrderRoutes       = require('./routes/salesOrder.routes');
const scanRoutes             = require('./routes/scan.routes');
const walletRoutes           = require('./routes/wallet.routes');
const giftCardRoutes         = require('./routes/giftcard.routes');
const giftCardClaimRoutes    = require('./routes/giftCardClaim.routes');
const loyaltyRoutes          = require('./routes/loyalty.routes');
const ttsRoutes              = require('./routes/tts.routes');

const app = express();
app.set('trust proxy', 1); // Trust first proxy (Vercel edge)
const PORT = process.env.PORT || 5001;
const isProduction = process.env.NODE_ENV === 'production';

// ────────────────────────────────────────────────
// CORS Configuration
// ────────────────────────────────────────────────
// Lives in config/cors.js so the allowlist can be asserted in the test suite —
// a header missing from it is invisible to curl and to every server-side test,
// and only ever shows up as "Failed to fetch" in a browser.
const { corsOptions } = require('./config/cors');

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
app.use(cookieParser());

// ────────────────────────────────────────────────
// API responses must never be cached
// ────────────────────────────────────────────────
// Without this, /api responses go out with the platform default
// `Cache-Control: public, max-age=0, must-revalidate` plus Express's ETag. That
// combination is storable and revalidatable, which broke tenant subdomains: a
// response cached while the user was on admin.drinksharbour.com carries
// `Access-Control-Allow-Origin: https://admin.drinksharbour.com`, and replaying
// it via a 304 for wyncity.drinksharbour.com fails the browser's CORS check —
// every API call from the tenant subdomain errored. (The allowlist itself is
// fine: corsOptions below reflects any *.drinksharbour.com origin, and
// `Vary: Origin` is present.)
//
// It is also a data-isolation matter, independent of CORS: `public` invites any
// shared cache to hold an authenticated, tenant-scoped payload — an employee
// list served from cache to a different tenant would be a cross-tenant leak.
// `private, no-store` makes these responses unstorable by every layer, so no
// revalidation happens and no stale ACAO can be replayed.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'private, no-store, max-age=0');
  next();
});

// ────────────────────────────────────────────────
// CSRF protection (double-submit cookie pattern)
// Applied to all /api routes — safe methods (GET/HEAD/OPTIONS) are exempt.
// ────────────────────────────────────────────────
const { csrfProtection } = require('./middleware/csrf.middleware');
app.use('/api', csrfProtection);

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
  // /api/mail is an interactive mail client: opening a folder and reading a
  // few messages easily exceeds 100 requests, and throttling it would lock the
  // user out of every other endpoint too. It has its own limiter below.
  skip: (req) => req.path === '/health' || req.path === '/api/ping' || req.originalUrl.startsWith('/api/mail'),
});
app.use('/api', limiter);

const mailLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 240,
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { success: false, message: 'Too many mail requests, please slow down.' },
});
app.use('/api/mail', mailLimiter);

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
app.use('/api/reviews',            reviewRoutes);
app.use('/api/users',              userRoutes);
app.use('/api/roles',              roleRoutes);
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
app.use('/api/deliveries',         deliveryRoutes);
app.use('/api/drivers',            driverRoutes);
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
app.use('/api/taxes',              taxRoutes);
app.use('/api/accounting',         accountingRoutes);
app.use('/api/shipping',           shippingRoutes);
app.use('/api/analytics',          analyticsRoutes);
app.use('/api/gemini',             geminiRoutes);
app.use('/api/banner-ai',          bannerGeminiRoutes);
app.use('/api/banners',            bannerRoutes);
app.use('/api/mail',               require('./routes/mail.routes'));
app.use('/api/blog',               blogRoutes);
app.use('/api/chatbot',            chatbotRoutes);
app.use('/api/places',             placesRoutes);
app.use('/api/tenants',            require('./routes/tenant.routes'));
app.use('/api/stores',             require('./routes/store.routes'));
app.use('/api/erm',                require('./routes/erm.routes'));
app.use('/api/employees',          require('./routes/employee.routes'));
const orgRouters = require('./routes/orgStructure.routes');
app.use('/api/departments',        orgRouters.departmentRouter);
app.use('/api/job-positions',      orgRouters.jobPositionRouter);
app.use('/api/employee-roles',     orgRouters.employeeRoleRouter);
const shiftRouters = require('./routes/shift.routes');
app.use('/api/shift-templates',    shiftRouters.shiftTemplateRouter);
app.use('/api/shifts',             shiftRouters.shiftRouter);
app.use('/api/attendance',         require('./routes/attendance.routes'));
app.use('/api/kiosk',              require('./routes/kiosk.routes'));
const timeOffRouters = require('./routes/timeOff.routes');
app.use('/api/time-off',           timeOffRouters.timeOffRouter);
app.use('/api/shift-swaps',        timeOffRouters.shiftSwapRouter);
const appraisalRouters = require('./routes/appraisal.routes');
app.use('/api/appraisal-cycles',   appraisalRouters.cycleRouter);
app.use('/api/appraisals',         appraisalRouters.appraisalRouter);
app.use('/api/appraisal-feedback', appraisalRouters.feedbackRouter);
app.use('/api/appraisal-templates', appraisalRouters.templateRouter);
app.use('/api/contacts',           require('./routes/contact.routes'));
app.use('/api/sales-orders',       salesOrderRoutes);
app.use('/api/scan',               scanRoutes);
app.use('/api/pos',                require('./routes/pos.routes'));
app.use('/api/pos-combos',         require('./routes/posCombo.routes'));
// ── Customer account: platform wallet, gift cards, loyalty (Corks & Points) ──
app.use('/api/wallet',             walletRoutes);
app.use('/api/gift-cards/claim',   giftCardClaimRoutes);
app.use('/api/gift-cards',         giftCardRoutes);
app.use('/api/loyalty',            loyaltyRoutes);
app.use('/api/tts',                ttsRoutes);

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

  // Always log the stack — the console is private, the response is not.
  console.error('   Stack:', err.stack);

  // A Mongoose schema validation failure is by definition bad input from the
  // caller, but nothing translated it, so it fell through as a generic 500 —
  // an over-length `declineReason` or `answers[].text` reported a server fault
  // for what was a form the user could have fixed. Matched by instance rather
  // than by `err.name`, which would also catch this app's own ValidationError
  // (utils/errors.js) — that one already carries statusCode 400 and a message
  // written for the caller, and must keep both.
  //
  // The raw Mongoose message is NOT returned: it names schema paths and echoes
  // the rejected value back. Only the field paths are, which is what a form
  // needs to highlight the offending inputs. CastError is deliberately left
  // alone — a malformed ObjectId reaching a handler is usually a routing or
  // client bug rather than user input, and this module's handlers already
  // validate ids they care about.
  if (err instanceof mongoose.Error.ValidationError) {
    return res.status(400).json({
      success: false,
      message: 'Some of the values submitted are invalid.',
      fields: Object.keys(err.errors || {}),
    });
  }

  const statusCode = err.statusCode || err.status || 500;

  // Diagnostics go in the RESPONSE only when NODE_ENV is explicitly
  // 'development'. This deliberately fails CLOSED. The previous test was
  // `NODE_ENV === 'production'`, which is false whenever NODE_ENV is unset — as
  // it is on the deployed Vercel backend — so every 500 shipped the raw error
  // message plus a stack trace naming internal /var/task/server paths to any
  // public caller. An unset or misspelled NODE_ENV must never re-open that.
  const exposeDiagnostics = process.env.NODE_ENV === 'development';

  res.status(statusCode).json({
    success: false,
    // 5xx messages are internal detail (missing module, failed query, driver
    // error); 4xx messages are addressed to the caller and stay verbatim.
    // `err.expose` is the narrow opt-out: a 5xx that describes a *named
    // upstream* the caller depends on (e.g. "Could not reach the mail server")
    // is written for the operator, and masking it turns a diagnosable outage
    // into an opaque 500. Only AppErrors constructed with expose=true qualify;
    // everything else still fails closed.
    message:
      !exposeDiagnostics && statusCode >= 500 && !err.expose
        ? 'Internal server error'
        : err.message,
    // Operational errors may attach structured `details` (e.g. the id of an
    // existing record a conflict points to) so the client can act on it.
    ...(err.details ? { details: err.details } : {}),
    ...(exposeDiagnostics ? { stack: err.stack?.split('\n').slice(0, 10) } : {}),
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
      const { startBannerScheduleCron } = require('./jobs/bannerSchedule.job');
      startBannerScheduleCron();
      const { startBlogLinkCheckCron } = require('./jobs/blogLinkCheck.job');
      startBlogLinkCheckCron();
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
