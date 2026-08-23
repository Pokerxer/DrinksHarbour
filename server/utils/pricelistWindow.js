// utils/pricelistWindow.js
/**
 * Mongo filter matching pricelists whose startDate/endDate window includes
 * `now`. A null or missing bound never excludes — unlike the previous inline
 * $or chains, which dropped lists that had only one bound set.
 */
function activeWindowFilter(now = new Date()) {
  return {
    $and: [
      {
        $or: [
          { startDate: null },
          { startDate: { $exists: false } },
          { startDate: { $lte: now } },
        ],
      },
      {
        $or: [
          { endDate: null },
          { endDate: { $exists: false } },
          { endDate: { $gte: now } },
        ],
      },
    ],
  };
}

module.exports = { activeWindowFilter };
