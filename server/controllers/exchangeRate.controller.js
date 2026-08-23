// controllers/exchangeRate.controller.js
const ExchangeRate = require('../models/ExchangeRate');
const liveRates = require('../services/liveRates.service');
const {
  normalizeEffectiveDate,
  sanitizeRateUpdate,
} = require('../services/exchangeRates.helpers');
const asyncHandler = require('../utils/asyncHandler');

const createExchangeRate = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { fromCurrency, toCurrency, rate, effectiveDate, isActive, notes } = req.body;

  if (!fromCurrency || !toCurrency || !rate || !effectiveDate) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  if (fromCurrency === toCurrency) {
    return res.status(400).json({ success: false, message: "Currencies must be different" });
  }

  // Schema min would reject it later as a generic ValidationError; fail fast
  // with a message the form can show.
  if (!(typeof rate === 'number' && Number.isFinite(rate) && rate > 0)) {
    return res.status(400).json({ success: false, message: "Rate must be greater than zero" });
  }

  // Normalise to UTC midnight of the calendar day so the upsert below matches
  // what the daily live sync writes regardless of time-of-day or server zone.
  const normalizedDate = normalizeEffectiveDate(effectiveDate);
  if (!normalizedDate) {
    return res.status(400).json({ success: false, message: "Invalid effective date" });
  }

  const existing = await ExchangeRate.findOne({
    tenant: tenantId,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
    effectiveDate: normalizedDate,
  });

  if (existing) {
    existing.rate = rate;
    existing.isActive = isActive !== false;
    existing.notes = notes;
    existing.source = 'manual';
    existing.updatedBy = userId;
    existing.effectiveDate = normalizedDate;
    await existing.save();
    return res.json({ success: true, data: existing });
  }

  const exchangeRate = await ExchangeRate.create({
    tenant: tenantId,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
    rate,
    effectiveDate: normalizedDate,
    isActive: isActive !== false,
    source: 'manual',
    notes,
    createdBy: userId,
  });

  res.status(201).json({ success: true, data: exchangeRate });
});

const getExchangeRates = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { fromCurrency, toCurrency, isActive, page = 1 } = req.query;
  // Cap page size — an unbounded `limit` let one request pull the whole ledger.
  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);

  const filter = { tenant: tenantId };
  if (fromCurrency) filter.fromCurrency = fromCurrency.toUpperCase();
  if (toCurrency) filter.toCurrency = toCurrency.toUpperCase();
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const rates = await ExchangeRate.find(filter)
    .populate('createdBy', 'name')
    .sort({ effectiveDate: -1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await ExchangeRate.countDocuments(filter);

  res.json({
    success: true,
    data: rates,
    pagination: {
      page: parseInt(page),
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
});

const getLatestRates = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;

  // Keep rates current: pull from the live provider when stale (no-op
  // when fresh; falls back to stored rates if the provider is down).
  await liveRates.autoSyncIfStale(tenantId, req.user._id);

  const rates = await ExchangeRate.aggregate([
    {
      $match: {
        tenant: tenantId,
        isActive: true,
        // Only rates already in effect — matches what convertCurrency will
        // actually apply, so the converter/analysis screens never display a
        // future-dated rate as if it were current.
        effectiveDate: { $lte: new Date() },
      },
    },
    { $sort: { effectiveDate: -1 } },
    {
      $group: {
        _id: { fromCurrency: '$fromCurrency', toCurrency: '$toCurrency' },
        rate: { $first: '$rate' },
        effectiveDate: { $first: '$effectiveDate' },
      },
    },
    {
      $project: {
        _id: 0,
        fromCurrency: '$_id.fromCurrency',
        toCurrency: '$_id.toCurrency',
        rate: 1,
        effectiveDate: 1,
      },
    },
  ]);

  res.json({ success: true, data: rates });
});

const convertCurrency = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { amount, fromCurrency, toCurrency } = req.query;

  if (!amount || !fromCurrency || !toCurrency) {
    return res.status(400).json({ success: false, message: 'Amount, fromCurrency, and toCurrency are required' });
  }

  await liveRates.autoSyncIfStale(tenantId, req.user._id);

  const converted = await ExchangeRate.convertCurrency(
    tenantId,
    parseFloat(amount),
    fromCurrency.toUpperCase(),
    toCurrency.toUpperCase()
  );

  if (converted === null) {
    return res.status(404).json({
      success: false,
      message: `No exchange rate found for ${fromCurrency} to ${toCurrency}`,
    });
  }

  res.json({
    success: true,
    data: {
      originalAmount: parseFloat(amount),
      fromCurrency: fromCurrency.toUpperCase(),
      toCurrency: toCurrency.toUpperCase(),
      convertedAmount: converted,
      rate: converted / parseFloat(amount),
    },
  });
});

const updateExchangeRate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const rate = await ExchangeRate.findOne({ _id: id, tenant: tenantId });
  if (!rate) {
    return res.status(404).json({ success: false, message: "Exchange rate not found" });
  }

  // Whitelist + validate. The previous implementation copied every body key
  // onto the document, letting a caller overwrite tenant-owned invariants.
  const { updates, error } = sanitizeRateUpdate(req.body);
  if (error) {
    return res.status(400).json({ success: false, message: error });
  }

  // Cross-field rule a per-field check can't see: patching one side of the
  // pair must not collapse it into NGN → NGN.
  const from = updates.fromCurrency ?? rate.fromCurrency;
  const to = updates.toCurrency ?? rate.toCurrency;
  if (from === to) {
    return res.status(400).json({ success: false, message: "Currencies must be different" });
  }

  Object.assign(rate, updates);
  rate.updatedBy = req.user._id;
  await rate.save();

  res.json({ success: true, data: rate });
});

const deleteExchangeRate = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const rate = await ExchangeRate.findOne({ _id: id, tenant: tenantId });
  if (!rate) {
    return res.status(404).json({ success: false, message: 'Exchange rate not found' });
  }

  await rate.deleteOne();

  res.json({ success: true, message: 'Exchange rate deleted' });
});

const syncLiveRates = asyncHandler(async (req, res) => {
  try {
    const result = await liveRates.syncLiveRates(req.tenant._id, req.user._id);
    res.json({
      success: true,
      data: result,
      message:
        result.skippedManual > 0
          ? `Updated ${result.updated} pair(s); kept ${result.skippedManual} manual rate(s) for today`
          : `Updated ${result.updated} pair(s) from live rates`,
    });
  } catch (error) {
    // A provider outage is worth naming for the admin who pressed Sync, but the
    // upstream error text is internal detail — log it, return a static message.
    console.error('Error syncing live exchange rates:', error);
    res.status(502).json({
      success: false,
      message: 'Could not fetch live rates from the provider. Please try again later.',
    });
  }
});

module.exports = {
  createExchangeRate,
  getExchangeRates,
  getLatestRates,
  convertCurrency,
  updateExchangeRate,
  deleteExchangeRate,
  syncLiveRates,
};
