'use strict';
const { ValidationError } = require('../../utils/errors');
const KINDS = ['marketplace', 'storefront', 'pos', 'venue'];
const FIELDS = ['tenant', 'code', 'kind', 'market', 'currency', 'active', 'legalOwner', 'paymentOwner', 'allowedPaymentOwners', 'pricingPolicy', 'storefrontChannel', 'apiKey', 'location'];
const objectId = value => typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
function keys(input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ValidationError('Configuration object is required');
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new ValidationError('Unknown channel configuration field');
}
function text(value) { return typeof value === 'string' && value.trim() === value && value.length > 0 && value.length <= 160 && !/[\r\n\x00]/.test(value); }
function owner(value, payment = false) {
  if (!value) throw new ValidationError('Explicit legal and payment owner are required');
  keys(value, payment ? ['type', 'reference', 'provider', 'account'] : ['type', 'reference']);
  if (!['tenant', 'platform'].includes(value.type) || !text(value.reference)) throw new ValidationError('Invalid legal/payment owner');
  if (payment && (!['paystack', 'korapay', 'stripe', 'wallet', 'gift_card', 'cash_on_delivery', 'bank_transfer', 'cash', 'manual'].includes(value.provider) || !/^[A-Za-z][A-Za-z0-9_-]{1,79}$/.test(value.account || ''))) throw new ValidationError('Explicit supported payment provider/account reference required');
}
function validateChannel(input) {
  keys(input, FIELDS);
  if (!KINDS.includes(input.kind) || !/^[A-Z][A-Z0-9_]{2,39}$/.test(input.code || '') || !/^[A-Z]{2}$/.test(input.market || '') || !/^[A-Z]{3}$/.test(input.currency || '') || typeof input.active !== 'boolean') throw new ValidationError('Invalid channel kind/code/market/currency/active');
  if (input.kind === 'marketplace' ? input.tenant !== null : !objectId(input.tenant)) throw new ValidationError('Channel tenant authority is invalid');
  owner(input.legalOwner); owner(input.paymentOwner, true);
  const type = input.kind === 'marketplace' ? 'platform' : 'tenant';
  if ([input.legalOwner, input.paymentOwner].some(value => value.type !== type || (type === 'tenant' && value.reference !== input.tenant)) || input.paymentOwner.reference !== input.legalOwner.reference) throw new ValidationError('Channel owner must match its legal/tenant authority');
  if (input.allowedPaymentOwners !== undefined) {
    if (!Array.isArray(input.allowedPaymentOwners) || input.allowedPaymentOwners.length > 12) throw new ValidationError('Invalid reviewed payment owners');
    if (input.kind !== 'marketplace' && input.allowedPaymentOwners.length) throw new ValidationError('Additional reviewed accounts are marketplace-only');
    for (const entry of input.allowedPaymentOwners) { owner(entry, true); if (entry.type !== type || entry.reference !== input.legalOwner.reference) throw new ValidationError('Payment account owner differs from channel legal owner'); }
    const bindings = [input.paymentOwner, ...input.allowedPaymentOwners].map(entry => entry.provider + ':' + entry.account);
    if (new Set(bindings).size !== bindings.length) throw new ValidationError('Duplicate reviewed provider/account');
  }
  if (!input.pricingPolicy) throw new ValidationError('Explicit reviewed pricing terms are required');
  keys(input.pricingPolicy, ['code', 'version', 'termsReference']);
  if (!/^[A-Z][A-Z0-9_]{2,59}$/.test(input.pricingPolicy.code || '') || !Number.isSafeInteger(input.pricingPolicy.version) || input.pricingPolicy.version < 1 || !text(input.pricingPolicy.termsReference)) throw new ValidationError('Invalid pricing policy or reviewed terms');
  for (const key of ['storefrontChannel', 'apiKey', 'location']) if (input[key] != null && !objectId(input[key])) throw new ValidationError(`Invalid channel ${key}`);
  if (input.kind === 'storefront' && (!input.storefrontChannel || !input.apiKey || !input.location || input.paymentOwner.provider !== 'paystack')) throw new ValidationError('Storefront requires existing channel/key/location and Paystack identity');
  if (input.kind !== 'storefront' && (input.storefrontChannel || input.apiKey)) throw new ValidationError('Direct website identity is only valid for storefront');
  if (['cash', 'manual'].includes(input.paymentOwner.provider) && !['pos', 'venue'].includes(input.kind)) throw new ValidationError('Online channel requires supported online provider');
  return JSON.parse(JSON.stringify(input));
}
module.exports = { validateChannel, FIELDS, KINDS, objectId, keys };
