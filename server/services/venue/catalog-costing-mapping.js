'use strict';
const { fail, requireId } = require('./errors');
function requireCatalogCostingUri(env = process.env) {
  const uri = env.VENUE_CATALOG_COSTING_MONGO_URI;
  if (typeof uri !== 'string' || !/^mongodb(?:\+srv)?:\/\//.test(uri))
    fail(
      'CATALOG_COSTING_TARGET_REQUIRED',
      'Explicit VENUE_CATALOG_COSTING_MONGO_URI is required',
      400,
    );
  return uri;
}
function validateMapping(mapping) {
  if (!mapping || typeof mapping !== 'object')
    fail('INVALID_MAPPING', 'Reviewed mapping required', 400);
  for (const key of ['tenantId', 'locationId', 'reviewedBy'])
    requireId(mapping[key]);
  if (
    typeof mapping.expectedDatabase !== 'string' ||
    !/^[\w-]+$/.test(mapping.expectedDatabase) ||
    typeof mapping.legacyIndexName !== 'string' ||
    !mapping.legacyIndexName
  )
    fail(
      'INVALID_MAPPING',
      'Exact database and legacy index name required',
      400,
    );
  for (const key of ['reviewedTenantIds', 'reviewedLegacySizeIds'])
    if (
      !Array.isArray(mapping[key]) ||
      new Set(mapping[key]).size !== mapping[key].length
    )
      fail('INVALID_MAPPING', 'Explicit reviewed IDs required', 400);
    else mapping[key].forEach(requireId);
  return mapping;
}
function parseCatalogCostingMapping(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) fail('INVALID_MAPPING', 'Markdown frontmatter required', 400);
  const mapping = {};
  const allowed = [
    'tenantId',
    'locationId',
    'reviewedBy',
    'expectedDatabase',
    'legacyIndexName',
    'reviewedTenantIds',
    'reviewedLegacySizeIds',
  ];
  for (const line of match[1].split(/\r?\n/)) {
    const part = /^([A-Za-z]+): ?([^\r\n]*)$/.exec(line);
    if (
      !part ||
      !allowed.includes(part[1]) ||
      Object.hasOwn(mapping, part[1]) ||
      /[{}\[\]"'`]/.test(part[2])
    )
      fail('INVALID_MAPPING', 'Unknown or nested mapping field', 400);
    mapping[part[1]] = part[2];
  }
  for (const key of ['reviewedTenantIds', 'reviewedLegacySizeIds'])
    mapping[key] = mapping[key]
      ? mapping[key].split(',').map((value) => value.trim())
      : [];
  return validateMapping(mapping);
}
module.exports = {
  requireCatalogCostingUri,
  validateMapping,
  parseCatalogCostingMapping,
};
