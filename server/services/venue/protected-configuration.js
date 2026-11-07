'use strict';
const { fail } = require('./errors');
function rejectOrdinaryVenueConfiguration(data) {
  if (Object.keys(data || {}).some(key => key.split('.')[0].startsWith('venue'))) fail('VENUE_MAPPING_REVIEW_REQUIRED', 'Reviewed venue configuration must use the audited mapping workflow', 403);
}
module.exports = { rejectOrdinaryVenueConfiguration };
