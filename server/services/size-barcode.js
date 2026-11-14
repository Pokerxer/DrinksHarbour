const { ConflictError, ValidationError } = require('../utils/errors');

/**
 * A tenant barcode is reusable once its current Size belongs to an archived
 * listing. Keep the old Size and its former barcode for historical reads.
 */
async function prepareSizeBarcode({ tenant, barcode, sizeId, session = null }) {
  const value = typeof barcode === 'string' || typeof barcode === 'number'
    ? String(barcode).trim()
    : '';
  if (!tenant || !value) return;

  const Size = require('../models/Size');
  const SubProduct = require('../models/SubProduct');
  const owner = await Size.findOne({
    tenant,
    barcode: value,
    ...(sizeId ? { _id: { $ne: sizeId } } : {}),
  }).select('subproduct updatedAt').session(session).lean();
  if (!owner) return;

  const listing = await SubProduct.findOne({ _id: owner.subproduct, tenant })
    .select('status sku').session(session).lean();
  if (listing?.status !== 'archived') {
    throw new ValidationError(
      `Barcode "${value}" is already in use by a size on listing "${listing?.sku || 'unknown'}".`
    );
  }

  const released = await Size.updateOne(
    {
      _id: owner._id,
      tenant,
      subproduct: owner.subproduct,
      barcode: value,
      updatedAt: owner.updatedAt ?? null,
    },
    { $set: { archivedBarcode: value }, $unset: { barcode: 1 } },
    { session }
  );
  if (!released.matchedCount) {
    throw new ConflictError(`Barcode "${value}" changed while being reassigned. Please retry.`);
  }
}

module.exports = { prepareSizeBarcode };
