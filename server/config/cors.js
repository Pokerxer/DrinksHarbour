// config/cors.js — who may call this API from a browser, and with what headers.
//
// Extracted from server.js so it can be asserted in the test suite. That is not
// tidiness: a missing entry in `allowedHeaders` is invisible everywhere except a
// real browser. The preflight still answers 204 with the list it does allow, and
// it is the browser that compares the two and blocks the request — so curl,
// Postman and every server-side test see a working endpoint while the app shows
// a bare "Failed to fetch" with no status to look up.

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
  // Every custom header below must also be sent by somebody. Adding one here is
  // half the job; `__tests__/cors.test.js` ties the auth-bearing ones to the
  // middleware that reads them.
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'x-tenant-slug',
    'x-is-tenant-site',
    'x-mfa-token',
    'x-csrf-token',
    // The public kiosk's device token. It is the ONLY credential a logged-out
    // clock has, so without this line the whole kiosk fails in a browser while
    // passing every server-side check.
    'x-kiosk-token',
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400,
  preflightContinue: false,
  optionsSuccessStatus: 204,
};

module.exports = { allowedOrigins, corsOptions };
