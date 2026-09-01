// server/controllers/adminCart.controller.js
//
// Admin read of the marketplace cart pipeline — the "Live Carts" tab on the
// admin Orders page. Shopper-facing cart endpoints live in cart.controller.js;
// this file is deliberately separate because the isolation rules are opposite:
// there, a user reads their own cart; here, staff read other people's.
//
// Two modes:
//   carts (default)   — live carts, the existing pipeline.
//   newCustomers      — shoppers registered within a window, shown whether or
//                       not they have a cart. A shopper with no non-empty cart
//                       anywhere is a "signup" row; everything else is a cart
//                       row with the usual tenant line filtering.
'use strict';

const mongoose = require('mongoose');
const Cart = require('../models/Cart');
const User = require('../models/User');
const SubProduct = require('../models/SubProduct');
const Size = require('../models/Size');
const { successResponse, errorResponse } = require('../utils/response');
const {
  BUCKET_IDS,
  buildCartRow,
  buildSignupRow,
  registrationWindowSince,
  summarize,
  summarizeNewCustomers,
} = require('../services/adminCarts.service');

// A search term maps to users before it maps to carts, so it needs its own
// cap — an unbounded $in of user ids would be the query, not a filter on it.
const USER_SEARCH_CAP = 500;
const MAX_LIMIT = 100;

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePagination(req) {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(req.query.limit, 10) || 20)
  );
  return { page, limit };
}

/**
 * Build the hydration maps (subproducts, sizes, users) for a page of cart
 * documents, then shape them into rows for this caller.
 */
async function buildRowsForCarts({ carts, tenantId, isPlatformAdmin, now }) {
  const subIds = new Set();
  const sizeIds = new Set();
  const userIds = new Set();
  for (const c of carts) {
    if (c.user) userIds.add(String(c.user));
    for (const it of c.items || []) {
      if (it.subproduct) subIds.add(String(it.subproduct));
      if (it.size) sizeIds.add(String(it.size));
    }
  }

  const [subs, sizes, users] = await Promise.all([
    subIds.size
      ? SubProduct.find({ _id: { $in: [...subIds] } })
          .select('_id tenant sku product')
          .populate('product', 'name')
          .lean()
      : [],
    sizeIds.size
      ? Size.find({ _id: { $in: [...sizeIds] } })
          .select('_id size')
          .lean()
      : [],
    userIds.size
      ? User.find({ _id: { $in: [...userIds] } })
          .select('_id firstName lastName email phone')
          .lean()
      : [],
  ]);

  const subById = new Map(subs.map((s) => [String(s._id), s]));
  const sizeNameById = new Map(sizes.map((s) => [String(s._id), s.size]));
  const userById = new Map(users.map((u) => [String(u._id), u]));

  return carts.map((cart) =>
    buildCartRow({
      cart,
      subById,
      sizeNameById,
      userById,
      tenantId,
      isPlatformAdmin,
      now,
    })
  );
}

/**
 * GET /api/cart/admin/list
 *
 * Cart mode query: page, limit, search (shopper name/email/phone), bucket
 *        (active|at_risk|abandoned), sort (updatedAt|value|items), order.
 * New-customer mode query: page, limit, search, newCustomers=1,
 *        registeredWithin (30|90|month|all). The bucket filter and the
 *        value/items sorts are ignored in this mode.
 *
 * Tenant admins are scoped by `items.tenant` — an indexed multikey path on the
 * cart item subdocument — so the scope is enforced by the query, not by
 * post-filtering a full scan. Platform admins (admin/super_admin) see all carts.
 */
exports.listCartsForAdmin = async (req, res) => {
  try {
    const role = req.user?.role;
    const isPlatformAdmin = ['admin', 'super_admin'].includes(role);
    const tenantId = req.user?.tenant ? String(req.user.tenant) : null;

    if (!isPlatformAdmin && !tenantId) {
      return errorResponse(res, 'No tenant context for this user', 403);
    }

    const { page, limit } = parsePagination(req);
    const now = new Date();
    const search = (req.query.search || '').trim();
    const newCustomersMode =
      req.query.newCustomers === '1' || req.query.newCustomers === 'true';

    // ── New-customer mode ──────────────────────────────────────────────────
    if (newCustomersMode) {
      const registeredWithin = ['90', 'month', 'all'].includes(
        req.query.registeredWithin
      )
        ? req.query.registeredWithin
        : '30';
      const since = registrationWindowSince(registeredWithin, now);

      const userCriteria = { role: 'customer', status: 'active' };
      if (since) userCriteria.createdAt = { $gte: since };
      if (search) {
        const rx = new RegExp(escapeRegex(search), 'i');
        userCriteria.$or = [
          { email: rx },
          { firstName: rx },
          { lastName: rx },
          { phone: rx },
        ];
      }

      const total = await User.countDocuments(userCriteria);
      const pageUsers = await User.find(userCriteria)
        .select('_id firstName lastName email phone createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const pageUserIds = pageUsers.map((u) => u._id);
      const pageCarts = pageUserIds.length
        ? await Cart.find({
            user: { $in: pageUserIds },
            'items.0': { $exists: true },
          }).lean()
        : [];
      const cartByUser = new Map(pageCarts.map((c) => [String(c.user), c]));

      const cartRows = await buildRowsForCarts({
        carts: [...cartByUser.values()],
        tenantId,
        isPlatformAdmin,
        now,
      });
      const cartRowsById = new Map(cartRows.map((r) => [String(r.user._id), r]));

      const rows = [];
      for (const u of pageUsers) {
        const row = cartRowsById.get(String(u._id));
        if (row) {
          rows.push(row);
        } else {
          rows.push(buildSignupRow(u, now, registeredWithin));
        }
      }
      // Cart rows first (current pipeline), signups after; each group newest
      // first. `rows.length` stays in 1:1 with pageUsers (unique cart per
      // user), so pagination.total (== userBase count) is exact.
      rows.sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === 'cart' ? -1 : 1;
        const aTs =
          a.kind === 'cart' ? new Date(a.updatedAt) : new Date(a.joinedAt);
        const bTs =
          b.kind === 'cart' ? new Date(b.updatedAt) : new Date(b.joinedAt);
        return bTs.getTime() - aTs.getTime();
      });

      return successResponse(
        res,
        {
          mode: 'newCustomers',
          rows,
          summary: summarizeNewCustomers(rows),
          // The window-wide acquisition count — the one number the shopper
          // actually asks for. Deliberately NOT page-local; labelled as such
          // in the UI ("New customers in window"), used only for that card.
          headline: { shoppers: total },
          pagination: {
            page,
            pages: Math.max(1, Math.ceil(total / limit)),
            total,
            limit,
          },
          // Only updatedAt sorts exist in this mode, so the sort is always
          // global — the page-local-sort caveat is suppressed client-side.
          sortScope: 'global',
          // Search in this mode paginates over the FULL matching set — there
          // is no user cap to truncate, so the flag is always false.
          searchTruncated: false,
          scope: isPlatformAdmin ? 'platform' : 'tenant',
        },
        'New customers fetched'
      );
    }

    // ── Cart mode (existing pipeline) ───────────────────────────────────────
    const bucket = BUCKET_IDS.includes(req.query.bucket)
      ? req.query.bucket
      : '';

    const query = { 'items.0': { $exists: true } };
    if (!isPlatformAdmin) {
      query['items.tenant'] = new mongoose.Types.ObjectId(tenantId);
    }

    // ── Age bucket → updatedAt window ───────────────────────────────────────
    const hoursAgo = (h) => new Date(now.getTime() - h * 3_600_000);
    if (bucket === 'active') query.updatedAt = { $gte: hoursAgo(24) };
    else if (bucket === 'at_risk')
      query.updatedAt = { $gte: hoursAgo(24 * 7), $lt: hoursAgo(24) };
    else if (bucket === 'abandoned') query.updatedAt = { $lt: hoursAgo(24 * 7) };

    // ── Search resolves to users first ──────────────────────────────────────
    let searchTruncated = false;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      const users = await User.find({
        $or: [{ email: rx }, { firstName: rx }, { lastName: rx }, { phone: rx }],
      })
        .select('_id')
        .limit(USER_SEARCH_CAP + 1)
        .lean();
      searchTruncated = users.length > USER_SEARCH_CAP;
      query.user = {
        $in: users.slice(0, USER_SEARCH_CAP).map((u) => u._id),
      };
    }

    // `value` and `items` are per-caller derived numbers (they depend on which
    // lines this tenant may see), so they cannot be sorted in the database.
    // Only updatedAt is a real index-backed sort; the other two are documented
    // to the client as page-local via `sortScope`.
    const sortField = ['updatedAt', 'value', 'items'].includes(req.query.sort)
      ? req.query.sort
      : 'updatedAt';
    const sortDir = req.query.order === 'asc' ? 1 : -1;

    const total = await Cart.countDocuments(query);
    const carts = await Cart.find(query)
      .sort({ updatedAt: sortDir })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    let rows = await buildRowsForCarts({
      carts,
      tenantId,
      isPlatformAdmin,
      now,
    });

    // A tenant-scoped cart always has at least one visible line (the query
    // guaranteed it), but a subproduct deleted since the cart was filled can
    // leave a row with nothing to show. Drop those rather than render blanks.
    // (Not applied in new-customer mode: there a zero-visible-line cart is
    // still a shopper a tenant may chase, and dropping them would silently
    // undercount the window.)
    rows = rows.filter((r) => r.itemCount > 0);

    if (sortField !== 'updatedAt') {
      const key = sortField === 'value' ? 'value' : 'itemCount';
      rows.sort((a, b) => (a[key] - b[key]) * sortDir);
    }

    return successResponse(
      res,
      {
        mode: 'carts',
        rows,
        summary: summarize(rows),
        pagination: {
          page,
          pages: Math.max(1, Math.ceil(total / limit)),
          total,
          limit,
        },
        // Honesty flags the UI surfaces rather than silently swallowing:
        // `sortScope` says a value/items sort only ordered THIS page, and
        // `searchTruncated` says the name search hit its user cap.
        sortScope: sortField === 'updatedAt' ? 'global' : 'page',
        searchTruncated,
        scope: isPlatformAdmin ? 'platform' : 'tenant',
      },
      'Carts fetched'
    );
  } catch (err) {
    return errorResponse(res, 'Failed to fetch carts', 500, err);
  }
};