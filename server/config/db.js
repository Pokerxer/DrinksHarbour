const mongoose = require('mongoose');

// Global cache for the connection promise to handle serverless environments
// efficiently. Held on `global` so it survives across warm invocations of the
// same Vercel container. Captured by reference — never reassign `global.mongoose`
// elsewhere, mutate these fields.
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

// A cold serverless container pays for SRV DNS resolution, a TLS handshake and
// full replica-set discovery before the first query can run. The driver's own
// default is 30 000 ms for exactly that reason; the 5 000 ms this used to run
// with turned an ordinary slow cold start into a 500. Kept well under a typical
// serverless function limit so a genuine outage fails fast rather than burning
// the whole invocation budget, and overridable per-environment.
const SERVER_SELECTION_TIMEOUT_MS =
  Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000;

// `mongoose.connect()` resolves to the mongoose instance; the live socket state
// lives on its default connection. 1 = connected, 2 = connecting — anything else
// (disconnected / disconnecting / uninitialized) is a dead handle, and because
// `bufferCommands` is false every query issued through it throws immediately
// instead of waiting for a reconnect. Returning such a handle from the cache is
// strictly worse than dialling again.
function isLive(instance) {
  const readyState = instance?.connection?.readyState;
  return readyState === 1 || readyState === 2;
}

let listenersBound = false;
function bindConnectionListeners(connection) {
  if (listenersBound || !connection || typeof connection.on !== 'function') return;
  listenersBound = true;

  connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
  });
  connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
    // Drop the cache so the next request dials again rather than handing out a
    // handle that can only throw. Bound once, not per connect, so repeated
    // reconnects cannot leak listeners onto the default connection.
    cached.conn = null;
    cached.promise = null;
  });
}

async function connectDB() {
  // Skip DB connection in serverless if no URI (allows server to start for health checks)
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri || mongoUri.includes('localhost')) {
    if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
      console.warn('⚠️  MongoDB URI not configured for production/serverless. Set MONGODB_URI in environment variables.');
      return null;
    }
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }
  }

  if (cached.conn) {
    if (isLive(cached.conn)) {
      return cached.conn;
    }
    // Stale handle — fall through and reconnect. The promise has to go too:
    // it has already settled to this same dead instance, so leaving it would
    // send the guard straight back to the handle we just rejected.
    cached.conn = null;
    cached.promise = null;
  }

  if (!cached.promise) {
    // Modern Mongoose options with improved timeouts and retry logic
    const opts = {
      bufferCommands: false, // Disable buffering for serverless
      serverSelectionTimeoutMS: SERVER_SELECTION_TIMEOUT_MS,
      socketTimeoutMS: 45000, // Socket timeout
      family: 4, // Prefer IPv4
      maxPoolSize: 10, // Limit connection pool for serverless efficiency
      minPoolSize: 1,
      retryWrites: true, // Enable retryable writes for better reliability
      retryReads: true, // Enable retryable reads
      w: 'majority', // Write concern for data durability
    };

    console.log('Creating new database connection');
    const attempt = mongoose.connect(mongoUri, opts)
      .then((mongooseInstance) => {
        console.log('New database connection established');
        bindConnectionListeners(mongooseInstance?.connection);
        return mongooseInstance;
      })
      .catch((err) => {
        // THE fix for the 2026-09-02 outage. A rejected promise left in the
        // cache is permanent: `if (!cached.promise)` above is then never true
        // again, so every later request on this warm container awaits the same
        // settled rejection and re-throws the same error with the same stack —
        // which is precisely what the logs showed, eleven unrelated routes
        // reporting one identical openUri timeout within four seconds. Clearing
        // it means one transient Atlas blip costs the requests in flight and
        // nothing more.
        //
        // Identity-checked so a concurrent request that has already installed a
        // *newer* attempt does not get its in-flight promise torn out.
        if (cached.promise === attempt) cached.promise = null;
        console.error('Database connection error:', err);
        throw err;
      });
    cached.promise = attempt;
  }

  const pending = cached.promise;
  try {
    cached.conn = await pending;
    return cached.conn;
  } catch (err) {
    if (cached.promise === pending) cached.promise = null;
    if (!isLive(cached.conn)) cached.conn = null;
    console.error('Failed to connect to database:', err);
    throw err;
  }
}

async function disconnectDB() {
  if (cached.conn) {
    if (process.env.NODE_ENV === 'production') {
      await mongoose.disconnect();
      cached.conn = null;
      cached.promise = null;
      console.log('Database disconnected in production');
    } else {
      console.log('Database not disconnected in non-production environment');
    }
  }
}

const db = { connectDB, disconnectDB };
module.exports = db;
