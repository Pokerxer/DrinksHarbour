function datePredicate(bounds) {
  const strings = Object.fromEntries(
    Object.entries(bounds).map(([k, v]) => [k, v.toISOString()]),
  );
  return {
    $or: [
      { 'metadata.expiryDate': bounds },
      { 'metadata.expiryDate': strings },
    ],
  };
}
function expiryConditions(status, now) {
  if (status === 'quarantined')
    return [{ 'metadata.quarantineStatus': 'quarantined' }];
  if (status === 'expired') return [datePredicate({ $lte: now })];
  if (status === 'soon')
    return [
      datePredicate({ $gt: now, $lte: new Date(+now + 30 * 86400000) }),
      { 'metadata.quarantineStatus': { $ne: 'quarantined' } },
    ];
  if (status === 'later')
    return [
      datePredicate({ $gt: new Date(+now + 30 * 86400000) }),
      { 'metadata.quarantineStatus': { $ne: 'quarantined' } },
    ];
  return [];
}
function expiryRows(model, query, options) {
  // Aggregations do not apply Mongoose's normal query casting.
  const match = model.schema
    ? new (require('mongoose').Query)(query).cast(model)
    : query;
  return model
    .aggregate([
      { $match: match },
      {
        $addFields: {
          __expirySort: {
            $convert: {
              input: '$metadata.expiryDate',
              to: 'date',
              onError: null,
              onNull: null,
            },
          },
        },
      },
      {
        $addFields: {
          __expiryMissing: { $cond: [{ $eq: ['$__expirySort', null] }, 1, 0] },
        },
      },
      {
        $sort: {
          __expiryMissing: 1,
          __expirySort: options.sort === 'expiry_latest' ? -1 : 1,
          createdAt: -1,
          _id: -1,
        },
      },
      { $skip: (options.page - 1) * options.limit },
      { $limit: options.limit },
      {
        $project: {
          type: 1,
          title: 1,
          message: 1,
          priority: 1,
          isRead: 1,
          createdAt: 1,
          readAt: 1,
          actionUrl: 1,
          actionLabel: 1,
          metadata: 1,
        },
      },
    ])
    .option({ maxTimeMS: 15000 });
}
module.exports = { datePredicate, expiryConditions, expiryRows };
