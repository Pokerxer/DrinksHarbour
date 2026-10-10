const Notification = require('../models/Notification');
const { allowedTypes } = require('./tenantNotificationRecipients');
async function deliverInsights(
  tenantId,
  drafts,
  recipients,
  now = new Date(),
  model = Notification,
) {
  let delivered = 0;
  const batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const operations = batch.splice(0);
    if (typeof model.bulkWrite === 'function') {
      try {
        await model.bulkWrite(operations, { ordered: false });
      } catch (error) {
        const failures = error.writeErrors || error.result?.getWriteErrors?.();
        const concerns =
          error.writeConcernErrors || error.result?.getWriteConcernErrors?.();
        if (
          !failures?.length ||
          concerns?.length ||
          error.writeConcernError ||
          failures.some((e) => e.code !== 11000)
        )
          throw error;
        await model.bulkWrite(
          failures.map((e) => ({
            updateOne: { ...operations[e.index].updateOne, upsert: false },
          })),
          { ordered: false },
        );
      }
    } else {
      // Small adapters can expose updateOne; production uses bounded bulk writes.
      for (const { updateOne: op } of operations) {
        try {
          await model.updateOne(op.filter, op.update, { upsert: true });
        } catch (error) {
          if (error.code !== 11000) throw error;
          await model.updateOne(op.filter, op.update, { upsert: false });
        }
      }
    }
    delivered += operations.length;
  };
  for (const draft of drafts)
    for (const recipient of recipients) {
      if (
        draft.purchaseOnly &&
        !['tenant_owner', 'tenant_admin'].includes(recipient.role)
      )
        continue;
      if (!allowedTypes(recipient).includes(draft.type)) continue;
      const filter = {
        tenant: tenantId,
        recipient: recipient._id,
        dedupKey: draft.identity,
      };
      const update = {
        $set: {
          title: draft.title,
          message: draft.message,
          priority: draft.priority,
          ...(draft.actionUrl
            ? { actionUrl: draft.actionUrl, actionLabel: draft.actionLabel }
            : {}),
          ...(draft.forecastValidUntil
            ? { forecastValidUntil: draft.forecastValidUntil }
            : {}),
          metadata: { ...draft.metadata, lastObservedAt: now },
        },
        $setOnInsert: {
          ...filter,
          type: draft.type,
          subProduct: draft.subProduct,
          isRead: false,
          isArchived: false,
        },
      };
      batch.push({ updateOne: { filter, update, upsert: true } });
      if (batch.length === 500) await flush();
    }
  await flush();
  return { delivered };
}
async function resolveStockEpisodes(
  tenantId,
  activeKeys,
  unknownProducts,
  now = new Date(),
  model = Notification,
  recipientId,
) {
  return model.updateMany(
    {
      tenant: tenantId,
      ...(recipientId ? { recipient: recipientId } : {}),
      type: 'low_stock_alert',
      isArchived: false,
      dedupKey: { $type: 'string', $nin: activeKeys },
      subProduct: { $nin: unknownProducts },
      $or: [
        { 'metadata.lastObservedAt': { $lte: now } },
        { 'metadata.lastObservedAt': { $exists: false } },
      ],
      $and: [
        {
          $or: [
            { forecastValidUntil: null },
            { forecastValidUntil: { $lte: now } },
          ],
        },
      ],
    },
    { $set: { isArchived: true, archivedAt: now }, $unset: { dedupKey: 1 } },
  );
}
module.exports = { deliverInsights, resolveStockEpisodes };
