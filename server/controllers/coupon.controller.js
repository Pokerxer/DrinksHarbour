// controllers/coupon.controller.js

const couponService = require('../services/coupon.service');
const { successResponse } = require('../utils/response');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * @desc    Create new coupon
 * @route   POST /api/coupons
 * @access  Private/Admin
 */
exports.createCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.createCoupon(req.body, req.user._id);

    successResponse(res, coupon, 'Coupon created successfully', 201);
});

/**
 * @desc    Get all coupons
 * @route   GET /api/coupons
 * @access  Private/Admin
 */
exports.getAllCoupons = asyncHandler(async (req, res) => {
    const result = await couponService.getAllCoupons(req.query);

    successResponse(res, result, 'Coupons retrieved successfully');
});

/**
 * @desc    Get coupon by ID
 * @route   GET /api/coupons/:id
 * @access  Private/Admin
 */
exports.getCouponById = asyncHandler(async (req, res) => {
    const coupon = await couponService.getCouponById(req.params.id);

    successResponse(res, coupon, 'Coupon retrieved successfully');
});

/**
 * @desc    Get coupon by code (public - for validation)
 * @route   GET /api/coupons/code/:code
 * @access  Public
 */
exports.getCouponByCode = asyncHandler(async (req, res) => {
    const coupon = await couponService.getCouponByCode(req.params.code);

    successResponse(res, coupon, 'Coupon retrieved successfully');
});

/**
 * @desc    Validate coupon
 * @route   POST /api/coupons/validate
 * @access  Private/Public
 */
exports.validateCoupon = asyncHandler(async (req, res) => {
    const { code, cartData } = req.body;

    if (!code) {
        return res.status(400).json({
            success: false,
            message: 'Coupon code is required',
        });
    }

    const userId = req.user?._id || null;

    const result = await couponService.validateCoupon(code, userId, cartData);

    successResponse(res, result, 'Coupon validated successfully');
});

/**
 * @desc    Apply coupon to order
 * @route   POST /api/coupons/apply
 * @access  Private
 */
exports.applyCoupon = asyncHandler(async (req, res) => {
    const { code, orderData } = req.body;
    console.log(code, orderData)

    if (!code || !orderData) {
        return res.status(400).json({
            success: false,
            message: 'Coupon code and order data are required',
        });
    }

    const result = await couponService.applyCoupon(code, req.user._id, orderData);

    successResponse(res, result, 'Coupon applied successfully');
});

/**
 * @desc    Record coupon usage (internal/after order completion)
 * @route   POST /api/coupons/:id/record-usage
 * @access  Private/Admin
 */
exports.recordCouponUsage = asyncHandler(async (req, res) => {
    const { userId, orderAmount, discountApplied, orderId } = req.body;

    const result = await couponService.recordCouponUsage(
        req.params.id,
        userId,
        orderAmount,
        discountApplied,
        orderId
    );

    successResponse(res, result, 'Coupon usage recorded');
});

/**
 * @desc    Update coupon
 * @route   PUT /api/coupons/:id
 * @access  Private/Admin
 */
exports.updateCoupon = asyncHandler(async (req, res) => {
    const coupon = await couponService.updateCoupon(
        req.params.id,
        req.body,
        req.user._id
    );

    successResponse(res, coupon, 'Coupon updated successfully');
});

/**
 * @desc    Delete coupon
 * @route   DELETE /api/coupons/:id
 * @access  Private/Admin
 */
exports.deleteCoupon = asyncHandler(async (req, res) => {
    const result = await couponService.deleteCoupon(req.params.id, req.user._id);

    successResponse(res, result, 'Coupon deleted successfully');
});

/**
 * @desc    Toggle coupon status (activate/deactivate)
 * @route   PATCH /api/coupons/:id/toggle-status
 * @access  Private/Admin
 */
exports.toggleCouponStatus = asyncHandler(async (req, res) => {
    const result = await couponService.toggleCouponStatus(req.params.id, req.user._id);

    successResponse(res, result, 'Coupon status updated');
});

/**
 * @desc    Get coupon analytics
 * @route   GET /api/coupons/:id/analytics
 * @access  Private/Admin
 */
exports.getCouponAnalytics = asyncHandler(async (req, res) => {
    const analytics = await couponService.getCouponAnalytics(req.params.id);

    successResponse(res, analytics, 'Coupon analytics retrieved successfully');
});

/**
 * @desc    Get auto-apply coupons for cart
 * @route   POST /api/coupons/auto-apply
 * @access  Private
 */
exports.getAutoApplyCoupons = asyncHandler(async (req, res) => {
    const { cartData } = req.body;
    console.log(cartData)

    if (!cartData) {
        return res.status(400).json({
            success: false,
            message: 'Cart data is required',
        });
    }

    const coupons = await couponService.getAutoApplyCoupons(cartData, req.user?._id);

    successResponse(res, coupons, 'Auto-apply coupons retrieved');
});

/**
 * @desc    Generate unique coupon code
 * @route   POST /api/coupons/generate-code
 * @access  Private/Admin
 */
exports.generateCouponCode = asyncHandler(async (req, res) => {
    const { prefix, length } = req.body;

    const code = await couponService.generateCouponCode(prefix || '', length || 8);

    successResponse(res, { code }, 'Coupon code generated');
});

/**
 * @desc    Bulk create coupons
 * @route   POST /api/coupons/bulk-create
 * @access  Private/Admin
 */
exports.bulkCreateCoupons = asyncHandler(async (req, res) => {
    const { template, count } = req.body;

    if (!template || !count) {
        return res.status(400).json({
            success: false,
            message: 'Template and count are required',
        });
    }

    if (count > 1000) {
        return res.status(400).json({
            success: false,
            message: 'Maximum 1000 coupons can be created at once',
        });
    }

    const result = await couponService.bulkCreateCoupons(template, count, req.user._id);

    successResponse(res, result, 'Bulk coupons created successfully', 201);
});

/**
 * @desc    Update scheduled coupons (cron job)
 * @route   POST /api/coupons/cron/update-scheduled
 * @access  Private/Admin
 */
exports.updateScheduledCoupons = asyncHandler(async (req, res) => {
    const result = await couponService.updateScheduledCouponsStatus();

    successResponse(res, result, 'Scheduled coupons updated');
});

/**
 * @desc    Get active coupons for customer
 * @route   GET /api/coupons/customer/active
 * @access  Private/Customer
 */
exports.getActiveCouponsForCustomer = asyncHandler(async (req, res) => {
    const result = await couponService.getAllCoupons({
        status: 'active',
        isActive: true,
        isGlobal: true,
        page: req.query.page || 1,
        limit: req.query.limit || 20,
    });

    // Filter out coupons user isn't eligible for
    const Coupon = require('../models/Coupon');
    const eligibleCoupons = [];

    for (const coupon of result.coupons) {
        const couponDoc = await Coupon.findById(coupon._id);
        const eligibility = await couponDoc.canBeUsedBy(req.user._id);

        if (eligibility.canUse) {
            eligibleCoupons.push(coupon);
        }
    }

    successResponse(
        res,
        {
            coupons: eligibleCoupons,
            pagination: result.pagination,
        },
        'Active coupons retrieved'
    );
});

/**
 * @desc    Get user's coupon usage history
 * @route   GET /api/coupons/my-usage
 * @access  Private/Customer
 */
exports.getMyCouponUsage = asyncHandler(async (req, res) => {
    const Coupon = require('../models/Coupon');

    const coupons = await Coupon.find({
        'usedBy.user': req.user._id,
    })
        .select('code name discountType discountValue usedBy')
        .lean();

    const usageHistory = coupons.map(coupon => {
        const userUsages = coupon.usedBy.filter(
            u => u.user.toString() === req.user._id.toString()
        );

        return {
            coupon: {
                code: coupon.code,
                name: coupon.name,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
            },
            usageCount: userUsages.length,
            usages: userUsages.map(u => ({
                usedAt: u.usedAt,
                orderAmount: u.orderAmount,
                discountApplied: u.discountApplied,
                orderId: u.orderId,
            })),
            totalSaved: userUsages.reduce((sum, u) => sum + (u.discountApplied || 0), 0),
        };
    });

    const totalSaved = usageHistory.reduce((sum, h) => sum + h.totalSaved, 0);

    successResponse(
        res,
        {
            usageHistory,
            summary: {
                totalCouponsUsed: coupons.length,
                totalTimesCouponApplied: usageHistory.reduce((sum, h) => sum + h.usageCount, 0),
                totalAmountSaved: totalSaved,
            },
        },
        'Coupon usage history retrieved'
    );
});

/**
 * @desc    Check if specific coupon can be used
 * @route   GET /api/coupons/:code/can-use
 * @access  Private
 */
exports.canUseCoupon = asyncHandler(async (req, res) => {
    const Coupon = require('../models/Coupon');

    const coupon = await Coupon.findOne({ code: req.params.code.toUpperCase() });

    if (!coupon) {
        return res.status(404).json({
            success: false,
            message: 'Coupon not found',
        });
    }

    const eligibility = await coupon.canBeUsedBy(req.user._id);

    successResponse(res, eligibility, 'Eligibility checked');
});

/**
 * @desc    Get coupon statistics summary
 * @route   GET /api/coupons/stats/summary
 * @access  Private/Admin
 */
exports.getCouponStatistics = asyncHandler(async (req, res) => {
    const result = await couponService.getAllCoupons({
        page: 1,
        limit: 1,
        ...req.query,
    });

    const summary = {
        stats: result.stats,
    };

    successResponse(res, summary, 'Coupon statistics retrieved');
});

/**
 * @desc    Export coupons
 * @route   GET /api/coupons/export
 * @access  Private/Admin
 */
exports.exportCoupons = asyncHandler(async (req, res) => {
    const { format = 'json', ...filters } = req.query;

    const result = await couponService.getAllCoupons({
        ...filters,
        page: 1,
        limit: 10000, // Export all
    });

    if (format === 'csv') {
        const fields = [
            'code',
            'name',
            'discountType',
            'discountValue',
            'status',
            'timesUsed',
            'usageLimit',
            'startDate',
            'endDate',
            'totalDiscountGiven',
        ];

        const csv = [
            fields.join(','),
            ...result.coupons.map(coupon =>
                fields
                    .map(field => {
                        const value = coupon[field];
                        return typeof value === 'string' && value.includes(',')
                            ? `"${value}"`
                            : value || '';
                    })
                    .join(',')
            ),
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=coupons.csv');
        return res.send(csv);
    }

    // JSON format
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=coupons.json');
    successResponse(res, result.coupons, 'Coupons exported successfully');
});

/**
 * @desc    Clone coupon
 * @route   POST /api/coupons/:id/clone
 * @access  Private/Admin
 */
exports.cloneCoupon = asyncHandler(async (req, res) => {
    const originalCoupon = await couponService.getCouponById(req.params.id);

    // Remove unique fields
    const couponData = { ...originalCoupon };
    delete couponData._id;
    delete couponData.code;
    delete couponData.createdAt;
    delete couponData.updatedAt;
    delete couponData.timesUsed;
    delete couponData.usedBy;
    delete couponData.totalDiscountGiven;
    delete couponData.totalRevenue;

    // Update metadata
    couponData.name = `${couponData.name} (Copy)`;
    couponData.status = 'inactive';
    couponData.isActive = false;

    // Generate new code
    const newCode = await couponService.generateCouponCode(
        originalCoupon.code.substring(0, 3),
        10
    );
    couponData.code = newCode;

    const newCoupon = await couponService.createCoupon(couponData, req.user._id);

    successResponse(res, newCoupon, 'Coupon cloned successfully', 201);
});