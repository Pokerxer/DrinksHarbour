// controllers/reorder.controller.js

const reorderService = require('../services/reorder.service');
const asyncHandler = require('express-async-handler');

/**
 * @desc    Create a new reorder rule
 * @route   POST /api/reorder/rules
 * @access  Private (Tenant admin)
 */
const createRule = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const rule = await reorderService.createRule(req.body, userId, tenantId);

  res.status(201).json({
    success: true,
    message: 'Reorder rule created successfully',
    data: rule,
  });
});

/**
 * @desc    Get all reorder rules
 * @route   GET /api/reorder/rules
 * @access  Private (Tenant admin)
 */
const getRules = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;
  const { subProductId, status, isActive, page, limit, sortBy, sortOrder } = req.query;

  const result = await reorderService.getRules(tenantId, {
    subProductId,
    status,
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
    page: parseInt(page) || 1,
    limit: parseInt(limit) || 50,
    sortBy,
    sortOrder,
  });

  res.status(200).json({
    success: true,
    data: result.rules,
    pagination: result.pagination,
  });
});

/**
 * @desc    Get a single reorder rule
 * @route   GET /api/reorder/rules/:id
 * @access  Private (Tenant admin)
 */
const getRuleById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  const rule = await reorderService.getRuleById(id, tenantId);

  res.status(200).json({
    success: true,
    data: rule,
  });
});

/**
 * @desc    Update a reorder rule
 * @route   PATCH /api/reorder/rules/:id
 * @access  Private (Tenant admin)
 */
const updateRule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;

  const rule = await reorderService.updateRule(id, req.body, tenantId, userId);

  res.status(200).json({
    success: true,
    message: 'Reorder rule updated successfully',
    data: rule,
  });
});

/**
 * @desc    Delete a reorder rule
 * @route   DELETE /api/reorder/rules/:id
 * @access  Private (Tenant admin)
 */
const deleteRule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const tenantId = req.tenant._id;

  await reorderService.deleteRule(id, tenantId);

  res.status(200).json({
    success: true,
    message: 'Reorder rule deleted successfully',
  });
});

/**
 * @desc    Check and trigger rules
 * @route   POST /api/reorder/check
 * @access  Private (Tenant admin)
 */
const checkRules = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;

  const results = await reorderService.checkRules(tenantId);

  res.status(200).json({
    success: true,
    message: `Checked rules, ${results.length} triggered`,
    data: results,
  });
});

/**
 * @desc    Manually trigger a rule
 * @route   POST /api/reorder/rules/:id/trigger
 * @access  Private (Tenant admin)
 */
const triggerRule = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const userId = req.user._id;
  const tenantId = req.tenant._id;
  const { notes } = req.body;

  const result = await reorderService.triggerRule(id, tenantId, userId, notes);

  res.status(200).json({
    success: true,
    message: 'Rule triggered successfully',
    data: result,
  });
});

/**
 * @desc    Get reorder suggestions
 * @route   GET /api/reorder/suggestions
 * @access  Private (Tenant admin)
 */
const getReorderSuggestions = asyncHandler(async (req, res) => {
  const tenantId = req.tenant._id;

  const suggestions = await reorderService.getReorderSuggestions(tenantId);

  res.status(200).json({
    success: true,
    data: suggestions,
  });
});

module.exports = {
  createRule,
  getRules,
  getRuleById,
  updateRule,
  deleteRule,
  checkRules,
  triggerRule,
  getReorderSuggestions,
};
