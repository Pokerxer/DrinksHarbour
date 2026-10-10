'use strict';
const router = require('express').Router();
const rateLimit = require('express-rate-limit').rateLimit;
const asyncHandler = require('../utils/asyncHandler');
const {
  requireStorefrontKey,
} = require('../middleware/integration.middleware');
const auth = require('../services/tenantCustomer.service');
const { fields } = require('../services/tenantCustomer.validation');
router.use(requireStorefrontKey);
const limited = (limit, windowMs) =>
  rateLimit({
    limit,
    windowMs,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: {
      success: false,
      code: 'rate_limited',
      message: 'Too many attempts. Please try again later',
    },
  });
const loginLimit = limited(20, 900000),
  recoveryLimit = limited(5, 3600000),
  registerLimit = limited(5, 3600000);
const handle = (action, status = 200) =>
  asyncHandler(async (req, res) => {
    res
      .status(status)
      .json({
        success: true,
        data: await action(req.integration.tenant, req.body),
      });
  });
router.post('/register', registerLimit, handle(auth.register, 201));
router.post('/login', loginLimit, handle(auth.login));
router.post('/mfa/verify', loginLimit, handle(auth.verifyMfa));
router.get(
  '/me',
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await auth.me(
        req.integration.tenant,
        req.headers['x-customer-token'],
      ),
    });
  }),
);
router.post(
  '/refresh-token',
  limited(30, 900000),
  handle((tenant, body) => {
    fields(body, ['refreshToken']);
    return auth.refresh(tenant, body.refreshToken);
  }),
);
router.post(
  '/logout',
  handle((tenant, body) => {
    fields(body, ['refreshToken']);
    return auth.logout(tenant, body.refreshToken);
  }),
);
router.post('/verify-email', loginLimit, handle(auth.verifyEmail));
router.post(
  '/resend-verification',
  recoveryLimit,
  handle(auth.resendVerification),
);
router.post('/forgot-password', recoveryLimit, handle(auth.forgotPassword));
router.post(
  '/reset-password/:token',
  loginLimit,
  asyncHandler(async (req, res) => {
    res.json({
      success: true,
      data: await auth.resetPassword(
        req.integration.tenant,
        req.params.token,
        req.body,
      ),
    });
  }),
);
module.exports = router;
