'use strict';
const { ConflictError } = require('../../../utils/errors');
function secret(account) {
  if (!/^[A-Z][A-Z0-9_]{0,59}$/.test(account || ''))
    throw new ConflictError('Original carrier account reference unavailable');
  const value = process.env[`SHIPBUBBLE_ACCOUNT_${account}`];
  if (typeof value !== 'string' || !/^sb_(sandbox|prod)_[A-Za-z0-9_-]+$/.test(value))
    throw new ConflictError('Original carrier account credential unavailable');
  return value;
}
async function request(account, path, body) {
  if (
    !/^\/shipping\/(address\/validate|fetch_rates|labels(?:\/list\/SB-[A-Z0-9]{1,80}|\/cancel\/SB-[A-Z0-9]{1,80})?)$/.test(
      path,
    )
  )
    throw new ConflictError('Unsupported carrier operation');
  const response = await fetch(`https://api.shipbubble.com/v1${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${secret(account)}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  const reader = response.body?.getReader();
  let size = 0;
  const chunks = [];
  if (!reader) throw new ConflictError('Carrier response unavailable');
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 262144) throw new ConflictError('Carrier response too large');
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  let result;
  try {
    result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ConflictError('Carrier response unavailable');
  }
  if (!response.ok || result?.status !== 'success')
    throw new ConflictError('Carrier request was not confirmed');
  return result.data;
}
module.exports = { request, secret };
