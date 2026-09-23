const mongoose = require('mongoose');
const KioskScan = require('../../models/KioskScan');
const Unknown = require('../../models/UnknownBarcodeScan');
const { ValidationError, ConflictError } = require('../../utils/errors');
function scanRequestId(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(value))
    throw new ValidationError('Invalid scan request.');
  return value;
}
async function logScan(context, barcode, requestId, result) {
  scanRequestId(requestId);
  const { kiosk } = context;
  const key = { tenant: kiosk.tenant, kiosk: kiosk._id, requestId };
  // Replica-set transaction keeps retries and unknown counts atomic. There is
  // no unsafe standalone fallback: failed writes must be retried, not dropped.
  try {
    await mongoose.connection.transaction(async (session) => {
      const existing = await KioskScan.findOne(key).session(session).lean();
      if (existing) {
        if (existing.barcode !== barcode) throw new ConflictError('Scan request already used.');
        return;
      }
      const scannedAt = new Date();
      await KioskScan.create(
        [
          {
            ...key,
            location: kiosk.location,
            shopId: kiosk.shopId,
            kioskName: kiosk.name,
            barcode,
            scannedAt,
            found: result.outcome === 'FOUND',
            outcome: result.outcome,
            ...result.record,
          },
        ],
        { session }
      );
      if (result.outcome === 'UNKNOWN') {
        await Unknown.updateOne(
          {
            tenant: kiosk.tenant,
            kiosk: kiosk._id,
            location: kiosk.location,
            barcode,
          },
          {
            $inc: { count: 1 },
            $set: { lastSeen: scannedAt, kioskName: kiosk.name },
            $setOnInsert: { firstSeen: scannedAt },
          },
          { upsert: true, session }
        );
      }
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    const existing = await KioskScan.findOne(key).lean();
    if (!existing || existing.barcode !== barcode) throw error;
  }
}
module.exports = { logScan, scanRequestId };
