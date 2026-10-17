const { ValidationError } = require('../../utils/errors');
const fail = (message) => { throw new ValidationError(message); };
// Cap minor units so Number storage remains exact. BigInt handles intermediate money arithmetic.
const MAX_MINOR = Number.MAX_SAFE_INTEGER;
function validateRoster(participants) {
  if (!Array.isArray(participants) || participants.length < 2) fail('Select at least two employees.');
  const seen = new Set();
  return participants.map((p) => {
    if (!p || typeof p.employee !== 'string' || !p.employee || seen.has(p.employee)) fail('Select distinct employees.');
    seen.add(p.employee);
    const amount = p.bonusAmount;
    const minor = Math.round(amount * 100);
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0 ||
        !Number.isSafeInteger(minor) || minor > MAX_MINOR || Math.abs(amount * 100 - minor) > 0.000001) {
      fail('Bonus allocations must be nonnegative amounts with at most two decimal places.');
    }
    return { employee: p.employee, allocationMinor: minor };
  });
}
function validateRatings(subjectIds, ratings, { complete = false } = {}) {
  if (!Array.isArray(ratings)) fail('Ratings must be a list.');
  const allowed = new Set(subjectIds.map(String));
  const seen = new Set();
  const normalized = ratings.map((r) => {
    if (!r || typeof r.subject !== 'string' || !allowed.has(r.subject) || seen.has(r.subject)) fail('Rate each assigned colleague only once.');
    if (!Number.isInteger(r.rating) || r.rating < 1 || r.rating > 5) fail('Ratings must be whole numbers from 1 to 5.');
    seen.add(r.subject);
    return { subject: r.subject, rating: r.rating };
  });
  if (complete && seen.size !== allowed.size) fail('Rate every colleague before submitting.');
  return normalized;
}
function calculateResult(ratings, allocationMinor) {
  if (!ratings.length || ratings.some(r => !Number.isInteger(r) || r < 1 || r > 5)) fail('A complete set of ratings is required.');
  if (!Number.isSafeInteger(allocationMinor) || allocationMinor < 0) fail('Invalid bonus allocation.');
  const sum = ratings.reduce((a, b) => a + b, 0);
  const denominator = BigInt(5 * ratings.length);
  const numerator = BigInt(sum) * BigInt(allocationMinor);
  const bonusMinor = Number((numerator * 2n + denominator) / (2n * denominator));
  return { averageScore: sum / ratings.length, ratingCount: ratings.length, bonusMinor };
}
module.exports = { validateRoster, validateRatings, calculateResult };
