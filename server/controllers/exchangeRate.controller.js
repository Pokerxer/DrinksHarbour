// controllers/exchangeRate.controller.js
const ExchangeRate = require('../models/ExchangeRate');

const createExchangeRate = async (req, res) => {
  try {
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
      notes,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: exchangeRate });
  } catch (error) {
    console.error('Error creating exchange rate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getExchangeRates = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error getting exchange rates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getLatestRates = async (req, res) => {
  try {
    const tenantId = req.tenant._id;

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
  } catch (error) {
    console.error('Error getting latest rates:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const convertCurrency = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { amount, fromCurrency, toCurrency } = req.query;

    if (!amount || !fromCurrency || !toCurrency) {
      return res.status(400).json({ success: false, message: 'Amount, fromCurrency, and toCurrency are required' });
    }

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
  } catch (error) {
    console.error('Error converting currency:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateExchangeRate = async (req, res) => {
  try {
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
  } catch (error) {
    console.error('Error updating exchange rate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteExchangeRate = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;

    const rate = await ExchangeRate.findOne({ _id: id, tenant: tenantId });
    if (!rate) {
      return res.status(404).json({ success: false, message: 'Exchange rate not found' });
    }

    await rate.deleteOne();

    res.json({ success: true, message: 'Exchange rate deleted' });
  } catch (error) {
    console.error('Error deleting exchange rate:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createExchangeRate,
  getExchangeRates,
  getLatestRates,
  convertCurrency,
  updateExchangeRate,
  deleteExchangeRate,
};
