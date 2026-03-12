// controllers/uomConversion.controller.js
const UOMConversion = require('../models/UOMConversion');

const createUOMConversion = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const { name, fromUOM, toUOM, conversionFactor, isActive, notes } = req.body;

    if (!name || !fromUOM || !toUOM || !conversionFactor) {
      return res.status(400).json({ success: false, message: 'Name, fromUOM, toUOM and conversionFactor are required' });
    }

    if (fromUOM === toUOM) {
      return res.status(400).json({ success: false, message: 'From and To UOM must be different' });
    }

    const existing = await UOMConversion.findOne({ 
      tenant: tenantId, 
      fromUOM, 
      toUOM 
    });
    
    if (existing) {
      return res.status(400).json({ success: false, message: 'Conversion already exists' });
    }

    const conversion = await UOMConversion.create({
      tenant: tenantId,
      name,
      fromUOM,
      toUOM,
      conversionFactor,
      isActive: isActive !== false,
      notes,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: conversion });
  } catch (error) {
    console.error('Error creating UOM conversion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUOMConversions = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { fromUOM, toUOM, isActive, page = 1, limit = 50 } = req.query;

    const filter = { tenant: tenantId };
    if (fromUOM) filter.fromUOM = fromUOM;
    if (toUOM) filter.toUOM = toUOM;
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const conversions = await UOMConversion.find(filter)
      .populate('createdBy', 'name')
      .sort({ fromUOM: 1, toUOM: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await UOMConversion.countDocuments(filter);

    res.json({
      success: true,
      data: conversions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error getting UOM conversions:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const getUOMConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const conversion = await UOMConversion.findById(id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');

    if (!conversion) {
      return res.status(404).json({ success: false, message: 'UOM conversion not found' });
    }

    res.json({ success: true, data: conversion });
  } catch (error) {
    console.error('Error getting UOM conversion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updateUOMConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;
    const userId = req.user._id;
    const updates = req.body;

    const conversion = await UOMConversion.findOne({ _id: id, tenant: tenantId });
    if (!conversion) {
      return res.status(404).json({ success: false, message: 'UOM conversion not found' });
    }

    Object.keys(updates).forEach(key => {
      if (key !== 'tenant' && key !== 'createdBy') {
        conversion[key] = updates[key];
      }
    });
    conversion.updatedBy = userId;

    await conversion.save();

    res.json({ success: true, data: conversion });
  } catch (error) {
    console.error('Error updating UOM conversion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deleteUOMConversion = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant._id;

    const conversion = await UOMConversion.findOne({ _id: id, tenant: tenantId });
    if (!conversion) {
      return res.status(404).json({ success: false, message: 'UOM conversion not found' });
    }

    await conversion.deleteOne();

    res.json({ success: true, message: 'UOM conversion deleted' });
  } catch (error) {
    console.error('Error deleting UOM conversion:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

const convertUnits = async (req, res) => {
  try {
    const tenantId = req.tenant._id;
    const { value, fromUOM, toUOM } = req.query;

    if (!value || !fromUOM || !toUOM) {
      return res.status(400).json({ success: false, message: 'Value, fromUOM and toUOM are required' });
    }

    const converted = await UOMConversion.convertUnits(
      tenantId,
      parseFloat(value),
      fromUOM,
      toUOM
    );

    if (converted === null) {
      return res.status(404).json({ 
        success: false, 
        message: `No conversion found from ${fromUOM} to ${toUOM}` 
      });
    }

    res.json({
      success: true,
      data: {
        originalValue: parseFloat(value),
        fromUOM,
        toUOM,
        convertedValue: converted,
      },
    });
  } catch (error) {
    console.error('Error converting units:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createUOMConversion,
  getUOMConversions,
  getUOMConversion,
  updateUOMConversion,
  deleteUOMConversion,
  convertUnits,
};
