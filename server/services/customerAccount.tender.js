// services/customerAccount.tender.js
//
// How much of a POS sale the customer's account actually covers. Pure arithmetic,
// no database and no request objects, because the interesting cases are hard to
// reach through a POS integration test and easy to state as examples.
//
// The rule: the stored-value balance is spent first, and whatever the balance
// cannot cover becomes a tab charge. Both halves matter. Spending only part of
// the balance strands stored value the customer paid for; tabbing the whole
// total overdraws a customer who has money available.

const { round2 } = require('./accounting.helpers');

/**
 * @param {number}  payableTotal    the sale total after discount and rounding
 * @param {number}  availableBalance stored value on the customer's account
 * @param {number}  creditLimit     the most the customer may owe in total
 * @param {number}  tabBalance      what they already owe
 * @param {boolean} [allowOverride] a manager has authorised this sale
 * @returns {{
 *   payableTotal: number, spend: number, shortfall: number, charged: boolean,
 *   withinLimit: boolean, requiresOverride: boolean, requiredLimit: number,
 *   tenders: Array<{ method: string, amount: number }>,
 * }}
 */
function splitAccountTender({
  payableTotal,
  availableBalance,
  creditLimit,
  tabBalance,
  allowOverride = false,
}) {
  const total = Number(payableTotal);
  if (!Number.isFinite(total)) throw new Error('The sale total must be finite');
  if (total <= 0) throw new Error('The sale total must be positive');

  const owed = Number(tabBalance);
  // An unreadable balance must not be treated as zero: that would authorise
  // credit nobody granted.
  if (!Number.isFinite(owed)) throw new Error('The tab balance must be finite');

  // A negative stored balance cannot happen behind the wallet's overdraw guard,
  // but treating it as zero keeps a corrupted value from yielding a negative
  // `spend` — which would credit the customer's wallet instead of debiting it.
  const available = Math.max(0, Number(availableBalance) || 0);
  const limit = Math.max(0, Number(creditLimit) || 0);

  const spend = round2(Math.min(available, total));
  // Rounded separately, not as `total - spend`, so the two always add back to
  // the total exactly. A tender split that falls a kobo short is rejected by
  // the journal at the worst possible moment.
  const shortfall = round2(total - spend);
  const charged = shortfall > 0;

  // The limit is on the TOTAL owed, so the standing debt counts. Checking only
  // this sale would let the tab exceed its limit by exactly the amount already
  // owed.
  const requiredLimit = round2(owed + shortfall);
  const overLimit = charged && requiredLimit > limit;

  const tenders = [];
  if (spend > 0) tenders.push({ method: 'wallet', amount: spend });
  if (shortfall > 0) tenders.push({ method: 'account', amount: shortfall });

  return {
    payableTotal: round2(total),
    spend,
    shortfall,
    charged,
    withinLimit: !overLimit || !!allowOverride,
    // True when the limit blocked this sale and only an override can clear it.
    // An override satisfies the guard without hiding that it was needed.
    requiresOverride: overLimit,
    requiredLimit,
    tenders,
  };
}

module.exports = { splitAccountTender };
