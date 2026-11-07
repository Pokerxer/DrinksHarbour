'use strict';

const { UnauthorizedError } = require('./errors');

// A valid signature is not enough: challenge, step-up and refresh tokens must
// never establish an API session. Existing access tokens have no type claim.
function assertAccessToken(decoded) {
  if (!decoded || typeof decoded !== 'object' ||
      (decoded.type !== undefined && decoded.type !== 'access')) {
    throw new UnauthorizedError('Not authorized - access token required');
  }
}

module.exports = { assertAccessToken };
