// server/controllers/referral.controller.js
//
// The customer-facing referral page. Self-scoped to the JWT user — a referral
// link does not entitle the sharer to a referee's contact details, so referees
// are always reported by display name or a masked email, never in full.

const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/response');
const { frontendBaseUrl } = require('../utils/frontendUrl');
const User = require('../models/User');
const Referral = require('../models/Referral');
const { REFERRAL_CONFIG, summarizeReferrals } = require('../services/referral.helpers');

const LIST_LIMIT = 50;

/** "Ada O." from a name, else "chi***@gmail.com", else "A friend". */
function displayName(u) {
  if (!u) return 'A friend';
  if (u.firstName) {
    return u.lastName ? `${u.firstName} ${u.lastName[0]}.` : u.firstName;
  }
  if (u.email) {
    const [local, domain] = u.email.split('@');
    return `${local.slice(0, 3)}***@${domain || ''}`;
  }
  return 'A friend';
}

const STATUS_LABEL = {
  pending:   'joined — verifying email',
  qualified: 'joined — yet to order',
  paid:      'ordered',
  rejected:  'not eligible',
  reversed:  'order refunded',
};

/**
 * @desc    The caller's referral code, share link, terms, totals and referrals.
 * @route   GET /api/referrals
 * @access  Private (customer)
 */
const getReferrals = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('referralCode firstName');
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });

  if (!user.referralCode) {
    user.generateReferralCode();
    await user.save();
  }

  // Totals cover ALL referrals; the list is capped. A truncated list must not
  // produce a wrong headline figure.
  const [all, recent] = await Promise.all([
    Referral.find({ referrer: user._id }).select('status terms').lean(),
    Referral.find({ referrer: user._id })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT)
      .populate({ path: 'referee', select: 'firstName lastName email' })
      .lean(),
  ]);

  successResponse(res, {
    code: user.referralCode,
    link: `${frontendBaseUrl(process.env.PLATFORM_URL)}/register?ref=${user.referralCode}`,
    terms: {
      refereeDiscountNgn: REFERRAL_CONFIG.refereeDiscountNgn,
      referrerCreditNgn:  REFERRAL_CONFIG.referrerCreditNgn,
      minSpendNgn:        REFERRAL_CONFIG.minSpendNgn,
      couponValidDays:    REFERRAL_CONFIG.couponValidDays,
    },
    summary: summarizeReferrals(all),
    referrals: recent.map(r => ({
      _id: r._id,
      name: displayName(r.referee),
      status: r.status,
      statusLabel: STATUS_LABEL[r.status] || r.status,
      creditNgn: r.status === 'paid' ? (r.terms?.referrerCreditNgn || 0) : 0,
      rejectedReason: r.rejectedReason || '',
      signupAt: r.signupAt,
      paidAt: r.paidAt,
    })),
    listTruncatedAt: all.length > LIST_LIMIT ? LIST_LIMIT : null,
  }, 'Referrals retrieved');
});

module.exports = { getReferrals };
