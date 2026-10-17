const { isTransientConnectionError } = require('./db-retry');

// Retry only the connection handshake, before jobs, index work or HTTP startup.
// Mongoose wraps driver selection errors in MongooseServerSelectionError.
async function withDbStartupRetry(connect, { delayMs = 1000, onRetry = () => {} } = {}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await connect();
    } catch (err) {
      const transient = err?.name === 'MongooseServerSelectionError' || isTransientConnectionError(err);
      if (!transient || attempt === 3) throw err;
      onRetry(attempt, err);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

module.exports = { withDbStartupRetry };
