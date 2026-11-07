const registry = require('../constants/businessSpecifications.json');
const { industriesForProductType } = require('../constants/industries');
const allFields = [...new Set(Object.values(registry).flat())];
function fieldsFor(type) {
  return registry[industriesForProductType(type)?.[0]] || [];
}
function cleanSpecifications(value, type) {
  const out = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return out;
  for (const key of fieldsFor(type)) {
    if (typeof value[key] === 'string' && value[key].trim())
      out[key] = value[key].replace(/<[^>]*>/g, '').trim().slice(0, 1000);
  }
  return out;
}
module.exports = { allFields, fieldsFor, cleanSpecifications };
