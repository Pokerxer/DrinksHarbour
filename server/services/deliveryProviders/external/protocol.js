'use strict';
const crypto = require('node:crypto');
const { ConflictError } = require('../../../utils/errors');
function minor(value) {
  const raw = String(value);
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new ConflictError('Invalid carrier money');
  const [whole, fraction = ''] = raw.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new ConflictError('Carrier money overflow');
  return Number(result);
}
function rates(data, allowed, budget) {
  if (
    typeof data?.request_token !== 'string' ||
    !data.request_token ||
    data.request_token.length > 512 ||
    !Array.isArray(data.couriers)
  )
    throw new ConflictError('Carrier quote evidence unavailable');
  const found = [];
  const seen = new Set();
  for (const row of data.couriers.slice(0, 100)) {
    if (
      !row ||
      row.currency !== 'NGN' ||
      row.service_type !== 'pickup' ||
      !allowed.some(
        (pair) =>
          pair.courierId === String(row.courier_id) && pair.serviceCode === row.service_code,
      )
    )
      continue;
    const amountMinor = minor(row.total),
      displayMinor = minor(row.rate_card_amount);
    if (amountMinor > budget || displayMinor > budget) continue;
    const identity = `${row.courier_id}:${row.service_code}`;
    if (seen.has(identity)) throw new ConflictError('Ambiguous carrier rate evidence');
    seen.add(identity);
    found.push({
      courierId: String(row.courier_id),
      serviceCode: row.service_code,
      name: typeof row.courier_name === 'string' ? row.courier_name.slice(0, 120) : 'Carrier',
      amountMinor,
      displayMinor,
    });
  }
  return { requestToken: data.request_token, rates: found };
}
function observation(row, expected) {
  if (
    typeof expected !== 'string' ||
    !/^SB-[A-Z0-9]{1,80}$/.test(expected) ||
    row?.order_id !== expected ||
    !['pending', 'confirmed', 'picked_up', 'in_transit', 'completed', 'cancelled'].includes(
      row.status,
    )
  )
    throw new ConflictError('Carrier shipment evidence does not match original responsibility');
  return { status: row.status };
}
function verifySignature(raw, signature, secret) {
  if (
    !Buffer.isBuffer(raw) ||
    typeof secret !== 'string' ||
    !secret ||
    typeof signature !== 'string' ||
    !/^[a-f0-9]{128}$/i.test(signature)
  )
    return false;
  const expected = crypto.createHmac('sha512', secret).update(raw).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature, 'hex'));
}
module.exports = { minor, rates, observation, verifySignature };
