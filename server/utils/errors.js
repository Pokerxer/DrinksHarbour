class AppError extends Error {
  /**
   * @param {string}  message
   * @param {number}  statusCode
   * @param {boolean} expose - Send `message` to the caller even on a 5xx.
   *   The global error handler masks every 5xx message as 'Internal server
   *   error', because a 5xx normally carries internal detail (a failed query, a
   *   driver error, a missing module) that must not reach a public caller. A
   *   few 5xx errors are different: they describe an *upstream* service the
   *   caller depends on, and the whole point of raising them is to tell the
   *   operator which upstream broke. Those opt in here. Defaults to false so
   *   the masking stays fail-closed for everything that does not ask.
   */
  constructor(message, statusCode, expose = false) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.expose = expose;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
  }
}

class NotFoundError extends AppError {
  constructor(message) {
    super(message, 404);
  }
}

class ForbiddenError extends AppError {
  constructor(message) {
    super(message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
  }
}

class AuthorizationError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

class UnauthorizedError extends AppError {
  constructor(message) {
    super(message, 401);
  }
}

module.exports = {
  AppError,
  ValidationError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
  AuthorizationError,
  UnauthorizedError,
};