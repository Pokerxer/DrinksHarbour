const mongoose = require('mongoose');
const Scan = require('../../models/KioskScan');
const Kiosk = require('../../models/PriceCheckerKiosk');
const { ValidationError } = require('../../utils/errors');
const { id } = require('./validation');
const { loadContext } = require('./context');
const { lookup } = require('./lookup');
const DAY = 86400000;
const lagosDate = (date) => new Date(date.getTime() + 3600000).toISOString().slice(0, 10);
function midnight(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ValidationError('Use YYYY-MM-DD dates.');
  const date = new Date(`${value}T00:00:00+01:00`);
  if (!Number.isFinite(date.getTime()) || lagosDate(date) !== value)
    throw new ValidationError('Invalid report date.');
  return date;
}
function reportRange(query = {}) {
  const endDay = query.to || lagosDate(new Date());
  const end = new Date(midnight(endDay).getTime() + DAY);
  const start = query.from ? midnight(query.from) : new Date(end.getTime() - 30 * DAY);
  const page = Number(query.page || 1);
  if (
    start >= end ||
    end - start > 366 * DAY ||
    !Number.isInteger(page) ||
    page < 1 ||
    page > 10000
  )
    throw new ValidationError('Choose a date range of at most one year and a valid page.');
  return { start, end, page, skip: (page - 1) * 20 };
}
function interestPipeline(match, skip, lowStock = false) {
  const stages = [
    { $match: { ...match, size: { $ne: null } } },
    {
      $group: {
        _id: {
          kiosk: '$kiosk',
          location: '$location',
          size: '$size',
          tenant: '$tenant',
          barcode: '$barcode',
        },
        scans: { $sum: 1 },
        productName: { $last: '$productName' },
        kioskName: { $last: '$kioskName' },
      },
    },
  ];
  if (lowStock)
    stages.push(
      {
        $lookup: {
          from: 'warehousestocks',
          let: {
            tenant: '$_id.tenant',
            location: '$_id.location',
            size: '$_id.size',
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$tenant', '$$tenant'] },
                    { $eq: ['$warehouse', '$$location'] },
                    { $eq: ['$size', '$$size'] },
                  ],
                },
              },
            },
            {
              $project: {
                _id: 0,
                quantity: {
                  $max: [0, { $subtract: ['$currentQuantity', '$reservedQuantity'] }],
                },
                minStockLevel: 1,
              },
            },
          ],
          as: 'stock',
        },
      },
      {
        $set: {
          quantity: { $ifNull: [{ $arrayElemAt: ['$stock.quantity', 0] }, 0] },
          threshold: {
            $ifNull: [{ $arrayElemAt: ['$stock.minStockLevel', 0] }, 0],
          },
        },
      },
      { $match: { $expr: { $lte: ['$quantity', '$threshold'] } } }
    );
  return [
    ...stages,
    { $sort: { scans: -1, '_id.kiosk': 1, '_id.size': 1 } },
    { $skip: skip },
    { $limit: 21 },
  ];
}
async function getAnalytics(tenantId, query) {
  const range = reportRange(query);
  const tenant = new mongoose.Types.ObjectId(id(String(tenantId)));
  const scope = {
    tenant,
    ...(query.kiosk ? { kiosk: new mongoose.Types.ObjectId(id(query.kiosk)) } : {}),
  };
  const match = { ...scope, scannedAt: { $gte: range.start, $lt: range.end } };
  const today = midnight(lagosDate(new Date()));
  const dayOfWeek = new Date(today.getTime() + 3600000).getUTCDay();
  const week = new Date(today.getTime() - ((dayOfWeek + 6) % 7) * DAY);
  const month = midnight(`${lagosDate(today).slice(0, 7)}-01`);
  const [summary, periods, popular, lowStock] = await Promise.all([
    Scan.aggregate([
      { $match: match },
      {
        $facet: {
          counts: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                successful: { $sum: { $cond: ['$found', 1, 0] } },
                unknown: {
                  $sum: { $cond: [{ $eq: ['$outcome', 'UNKNOWN'] }, 1, 0] },
                },
              },
            },
          ],
          unique: [
            { $match: { product: { $ne: null } } },
            { $group: { _id: '$product' } },
            { $count: 'count' },
          ],
          active: [
            {
              $group: {
                _id: '$kiosk',
                name: { $last: '$kioskName' },
                scans: { $sum: 1 },
              },
            },
            { $sort: { scans: -1, _id: 1 } },
            { $limit: 1 },
          ],
          hours: [
            {
              $group: {
                _id: {
                  $hour: { date: '$scannedAt', timezone: 'Africa/Lagos' },
                },
                scans: { $sum: 1 },
              },
            },
            { $sort: { _id: 1 } },
          ],
          unknown: [
            { $match: { outcome: 'UNKNOWN' } },
            {
              $group: {
                _id: { kiosk: '$kiosk', barcode: '$barcode' },
                kioskName: { $last: '$kioskName' },
                count: { $sum: 1 },
                firstSeen: { $min: '$scannedAt' },
                lastSeen: { $max: '$scannedAt' },
              },
            },
            { $sort: { count: -1, '_id.barcode': 1 } },
            { $skip: range.skip },
            { $limit: 21 },
          ],
        },
      },
    ]),
    Scan.aggregate([
      {
        $match: {
          ...scope,
          scannedAt: {
            $gte: new Date(Math.min(week.getTime(), month.getTime())),
            $lte: new Date(),
          },
        },
      },
      {
        $group: {
          _id: null,
          today: { $sum: { $cond: [{ $gte: ['$scannedAt', today] }, 1, 0] } },
          week: { $sum: { $cond: [{ $gte: ['$scannedAt', week] }, 1, 0] } },
          month: { $sum: { $cond: [{ $gte: ['$scannedAt', month] }, 1, 0] } },
        },
      },
    ]),
    Scan.aggregate(interestPipeline(match, range.skip)),
    Scan.aggregate(interestPipeline(match, range.skip, true)),
  ]);
  const contexts = new Map();
  async function enrich(row) {
    const key = String(row._id.kiosk);
    if (!contexts.has(key))
      contexts.set(
        key,
        (async () => {
          const kiosk = await Kiosk.findOne({
            _id: row._id.kiosk,
            tenant,
          }).lean();
          if (!kiosk) return null;
          try {
            return await loadContext(kiosk);
          } catch (error) {
            if (error.statusCode) return null;
            throw error;
          }
        })()
      );
    const context = await contexts.get(key);
    const current =
      context && String(context.kiosk.location) === String(row._id.location)
        ? await lookup(context, row._id.barcode)
        : null;
    const sameSize = current && String(current.record?.size) === String(row._id.size);
    return {
      kiosk: key,
      kioskName: row.kioskName,
      barcode: row._id.barcode,
      productName: row.productName,
      scans: row.scans,
      currentPrice: sameSize ? (current.product?.price ?? null) : null,
      currency: sameSize ? current.product?.currency || null : null,
      ...(row.quantity !== undefined ? { quantity: row.quantity } : {}),
    };
  }
  const result = summary[0] || {};
  return {
    range: {
      from: lagosDate(range.start),
      to: lagosDate(new Date(range.end - DAY)),
      page: range.page,
    },
    overview: {
      total: 0,
      successful: 0,
      unknown: 0,
      ...result.counts?.[0],
      uniqueProducts: result.unique?.[0]?.count || 0,
      mostActiveKiosk: result.active?.[0]?.name || null,
      today: periods[0]?.today || 0,
      week: periods[0]?.week || 0,
      month: periods[0]?.month || 0,
    },
    hours: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      scans: result.hours?.find((row) => row._id === hour)?.scans || 0,
    })),
    popular: await Promise.all(popular.slice(0, 20).map(enrich)),
    lowStock: await Promise.all(lowStock.slice(0, 20).map(enrich)),
    unknown: (result.unknown || []).slice(0, 20).map((row) => ({
      barcode: row._id.barcode,
      kiosk: String(row._id.kiosk),
      kioskName: row.kioskName,
      count: row.count,
      firstSeen: row.firstSeen,
      lastSeen: row.lastSeen,
    })),
    hasMore: popular.length > 20 || lowStock.length > 20 || (result.unknown?.length || 0) > 20,
  };
}
module.exports = { reportRange, interestPipeline, getAnalytics };
