// controllers/exchangeRate.controller.js
const ExchangeRate = require('../models/ExchangeRate');
const liveRates = require('../services/liveRates.service');
const asyncHandler = require('../utils/asyncHandler');

const createExchangeRate = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const userId = req.user._id;
  const { fromCurrency, toCurrency, rate, effectiveDate, isActive, notes } = req.body;

  if (!fromCurrency || !toCurrency || !rate || !effectiveDate) {
    return res.status(400).json({ success: false, message: 'Missing required fields' });
  }

  if (fromCurrency === toCurrency) {
    return res.status(400).json({ success: false, message: 'Currencies must be different' });
  }

  const existing = await ExchangeRate.findOne({
    tenant: tenantId,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
    effectiveDate,
  });

  if (existing) {
    existing.rate = rate;
    existing.isActive = isActive !== false;
    existing.notes = notes;
    existing.source = 'manual';
    existing.updatedBy = userId;
    await existing.save();
    return res.json({ success: true, data: existing });
  }

  const exchangeRate = await ExchangeRate.create({
    tenant: tenantId,
    fromCurrency: fromCurrency.toUpperCase(),
    toCurrency: toCurrency.toUpperCase(),
    rate,
    effectiveDate,
    isActive: isActive !== false,
    source: 'manual',
    notes,
    createdBy: userId,
  });

  res.status(201).json({ success: true, data: exchangeRate });
});

const getExchangeRates = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { fromCurrency, toCurrency, isActive, page = 1, limit = 50 } = req.query;

  const filter = { tenant: tenantId };
  if (fromCurrency) filter.fromCurrency = fromCurrency.toUpperCase();
  if (toCurrency) filter.toCurrency = toCurrency.toUpperCase();
  if (isActive !== undefined) filter.isActive = isActive === 'true';

  const rates = await ExchangeRate.find(filter)
    .populate('createdBy', 'name')
    .sort({ effectiveDate: -1 })
    .skip((page - 1) * limit)
    .limit(parseInt(limit));

  const total = await ExchangeRate.countDocuments(filter);

  res.json({
    success: true,
    data: rates,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
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
    { $match: { tenant: tenantId, isActive: true } },
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
  const userId = req.user._id;
  const updates = req.body;

  const rate = await ExchangeRate.findOne({ _id: id, tenant: tenantId });
  if (!rate) {
    return res.status(404).json({ success: false, message: 'Exchange rate not found' });
  }

  Object.keys(updates).forEach(key => {
    if (key !== 'tenant' && key !== 'createdBy') {
      if (key === 'fromCurrency' || key === 'toCurrency') {
        rate[key] = updates[key].toUpperCase();
      } else {
        rate[key] = updates[key];
      }
    }
  });
  rate.updatedBy = userId;

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
