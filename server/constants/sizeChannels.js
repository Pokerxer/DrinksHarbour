'use strict';
// A beverage Product does not grant retail access to its venue-only portions.
// Missing versions remain legacy retail; malformed future versions fail closed.
const retailSizeWhereClause = () => ({
  $and: [
    { $or: [{ servingSchemaVersion: { $exists: false } }, { servingSchemaVersion: 1 }] },
    { size: { $ne: 'venue_serving' } },
    { venueServing: { $exists: false } },
  ],
});
module.exports = { retailSizeWhereClause };
