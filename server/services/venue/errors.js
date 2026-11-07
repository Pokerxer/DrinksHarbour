'use strict';
const { AppError } = require('../../utils/errors');
function fail(code, message = code, status = 409) { const error = new AppError(message, status); error.code = code; throw error; }
function requireId(value) { if (typeof value !== 'string' || !/^[a-f\d]{24}$/i.test(value)) fail('INVALID_ID', 'Invalid resource ID', 400); return value; }
module.exports = { fail, requireId };
