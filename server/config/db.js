const mongoose = require('mongoose');

// Global cache for the connection promise to handle serverless environments efficiently
let cached = global.mongoose;
if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

async function connectDB() {
  if (cached.conn) {
    console.log('Using existing database connection');
    return cached.conn;
  }

  if (!cached.promise) {
    const mongoUri = process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('MONGODB_URI is not defined in environment variables');
    }

    // Modern Mongoose options with improved timeouts and retry logic
    const opts = {
      bufferCommands: false, // Disable buffering for serverless
      serverSelectionTimeoutMS: 5000, // Timeout for server selection
      socketTimeoutMS: 45000, // Socket timeout
      family: 4, // Prefer IPv4
      maxPoolSize: 10, // Limit connection pool for serverless efficiency
      minPoolSize: 1,
      retryWrites: true, // Enable retryable writes for better reliability
      retryReads: true, // Enable retryable reads
      w: 'majority', // Write concern for data durability
    };

    console.log('Creating new database connection');
    cached.promise = mongoose.connect(mongoUri, opts)
      .then((mongooseInstance) => {
        console.log('New database connection established');
        // Optional: Set up connection event listeners for monitoring
        mongooseInstance.connection.on('error', (err) => {
          console.error('MongoDB connection error:', err);
        });
        mongooseInstance.connection.on('disconnected', () => {
          console.log('MongoDB disconnected');
        });
        return mongooseInstance;
      })
      .catch((err) => {
        console.error('Database connection error:', err);
        throw err; // Rethrow to handle upstream
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (err) {
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