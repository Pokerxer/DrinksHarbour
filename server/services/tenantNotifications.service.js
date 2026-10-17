const { presentExpiryNotice } = require("./expiryAlerts/payload");
const {
  datePredicate,
  expiryConditions,
  expiryRows,
} = require("./expiryAlerts/query");
const { validateDateRange } = require("../utils/notificationDateRange");
const { escapeRegex } = require("../utils/escapeRegex");
const Notification = require("../models/Notification");
const { syncTenantStockAlerts } = require("./tenantStockAlerts");
const { getTenantId } = require("../utils/tenantContext");
const {
  ValidationError,
  NotFoundError,
  ForbiddenError,
} = require("../utils/errors");
const { CATEGORIES, allowedTypes } = require("./tenantNotificationRecipients");
const { effectivePermissions } = require("./effectivePermissions.service");
const { safeNotificationAction } = require("../utils/notificationAction");
const DEMAND_METADATA = [
  "daysOfCover",
  "units30",
  "currentUnits",
  "previousUnits",
  "suggestedUnits",
  "model",
  "method",
  "stockoutDate",
  "forecastGeneratedAt",
];
const METADATA = [
  "productName",
  "periodStart",
  "periodEnd",
  "available",
  "threshold",
  "minimumSource",
  "minimumConfidence",
  "minimumUpdatedAt",
  "sizeName",
  "warehouseName",
  "currentUnits",
  "previousUnits",
  "suggestedUnits",
  "units30",
  "rule",
  "expiryDate",
  "batchId",
  "batchNumber",
  "quarantineStatus",
  "expiryState",
  "scanUpdatedAt",
  "quantity",
  "rejectionReason",
  ...DEMAND_METADATA,
];
function parseOptions(q = {}, now = new Date()) {
  const integer = (value, fallback, max) => {
    if (value === undefined) return fallback;
    if (
      typeof value !== "string" ||
      !/^[1-9]\d*$/.test(value) ||
      !Number.isSafeInteger(Number(value)) ||
      Number(value) > max
    )
      throw new ValidationError("Invalid pagination");
    return Number(value);
  };
  const category = q.category === undefined ? "all" : q.category;
  if (
    typeof category !== "string" ||
    (category !== "all" && !Object.hasOwn(CATEGORIES, category))
  )
    throw new ValidationError("Invalid notification category");
  if (q.unreadOnly !== undefined && !["true", "false"].includes(q.unreadOnly))
    throw new ValidationError("Invalid unreadOnly");
  if (
    q.search !== undefined &&
    (typeof q.search !== "string" || q.search.length > 200)
  )
    throw new ValidationError("Invalid notification search");
  if (
    q.sort !== undefined &&
    !(
      category === "expiry"
        ? ["newest", "oldest", "expiry_soonest", "expiry_latest"]
        : ["newest", "oldest"]
    ).includes(q.sort)
  )
    throw new ValidationError("Invalid notification sort");
  if (
    q.type !== undefined &&
    (category !== "products" || !CATEGORIES.products.includes(q.type))
  )
    throw new ValidationError("Invalid product decision filter");
  if (
    q.expiryStatus !== undefined &&
    (category !== "expiry" ||
      !["all", "expired", "soon", "later", "quarantined"].includes(
        q.expiryStatus,
      ))
  )
    throw new ValidationError("Invalid expiry status");
  const range = validateDateRange(q, now, false, category === "expiry");
  return {
    ...(range ? { range } : {}),
    search: (q.search || "").trim(),
    ...(category === "expiry" ? { expiryStatus: q.expiryStatus || "all" } : {}),
    sort: q.sort || "newest",
    page: integer(q.page, 1, 100000),
    limit: integer(q.limit, 20, 50),
    category,
    ...(q.type ? { type: q.type } : {}),
    unreadOnly: q.unreadOnly === "true",
  };
}
function inboxScope(req, now) {
  const user = req.user;
  if (!user || user.status !== "active")
    throw new ForbiddenError("Notification access unavailable");
  const platform = ["super_admin", "admin"].includes(user.role) && !user.tenant;
  // Do not resolve a client-selected tenant for inbox identity.
  if (!platform && !user.tenant)
    throw new ForbiddenError("Tenant identity required");
  const scope = {
    recipient: user._id,
    isArchived: false,
    type: { $in: allowedTypes(user) },
    $and: [
      { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      { $or: [{ scheduledFor: null }, { scheduledFor: { $lte: now } }] },
    ],
  };
  if (!platform) scope.tenant = getTenantId(req);
  return scope;
}
function publicNotice(row, user, now = new Date()) {
  const n = typeof row.toObject === "function" ? row.toObject() : row;
  const metadata = {};
  const reports =
    !user ||
    typeof user !== "object" ||
    effectivePermissions(user).includes("reports:read");
  for (const key of METADATA) {
    if (
      key === "expiryDate" &&
      n.metadata?.[key] instanceof Date &&
      Number.isFinite(+n.metadata[key])
    ) {
      metadata[key] = n.metadata[key].toISOString();
      continue;
    }
    if (
      (reports || !DEMAND_METADATA.includes(key)) &&
      ["string", "number"].includes(typeof n.metadata?.[key])
    )
      metadata[key] = n.metadata[key];
  }
  const safeUrl = safeNotificationAction(n.actionUrl) ? n.actionUrl : undefined;
  return presentExpiryNotice(
    {
      _id: String(n._id),
      type: n.type,
      title: n.title,
      message: n.message,
      priority: n.priority,
      isRead: n.isRead,
      createdAt: n.createdAt,
      readAt: n.readAt,
      actionUrl: safeUrl,
      actionLabel: safeUrl ? n.actionLabel : undefined,
      metadata,
    },
    now,
  );
}
function createInboxService(
  model = Notification,
  clock = () => new Date(),
  syncStock = syncTenantStockAlerts,
) {
  return {
    async list(req) {
      const now = clock(),
        o = parseOptions(req.query, now),
        base = inboxScope(req, now);
      await syncStock(req);
      if (o.range) {
        if (o.category === "expiry")
          base.$and.push(
            datePredicate({ $gte: o.range.start, $lt: o.range.end }),
          );
        else base.createdAt = { $gte: o.range.start, $lt: o.range.end };
      }
      const query = { ...base };
      if (o.category !== "all")
        query.type = {
          $in: CATEGORIES[o.category].filter((t) => base.type.$in.includes(t)),
        };
      if (o.type) query.type.$in = query.type.$in.filter((t) => t === o.type);
      if (o.category === "expiry")
        query.$and = [...base.$and, ...expiryConditions(o.expiryStatus, now)];
      if (o.unreadOnly) query.isRead = false;
      if (o.search)
        query.$and = [
          ...query.$and,
          {
            $or: [
              "title",
              "message",
              "metadata.productName",
              "metadata.sizeName",
              "metadata.warehouseName",
              "metadata.batchNumber",
            ].map((field) => ({
              [field]: { $regex: escapeRegex(o.search), $options: "i" },
            })),
          },
        ];
      const [rows, total, unreadCount, matchingUnreadCount] = await Promise.all(
        [
          o.sort.startsWith("expiry_")
            ? expiryRows(model, query, o)
            : model
                .find(query)
                .sort({
                  createdAt: o.sort === "oldest" ? 1 : -1,
                  _id: o.sort === "oldest" ? 1 : -1,
                })
                .skip((o.page - 1) * o.limit)
                .limit(o.limit)
                .select(
                  "type title message priority isRead createdAt readAt actionUrl actionLabel metadata",
                )
                .lean(),
          model.countDocuments(query),
          model.countDocuments({ ...base, isRead: false }),
          model.countDocuments({ ...query, isRead: false }),
        ],
      );
      return {
        notifications: rows.map((row) => publicNotice(row, req.user, now)),
        total,
        unreadCount,
        matchingUnreadCount,
        page: o.page,
        limit: o.limit,
      };
    },
    async markRead(req) {
      if (!/^[a-f\d]{24}$/i.test(req.params.id || ""))
        throw new ValidationError("Invalid notification ID");
      const now = clock();
      // Already-read rows return success without overwriting their original readAt.
      const scope = { ...inboxScope(req, now), _id: req.params.id };
      const row = await model.findOneAndUpdate(
        { ...scope, isRead: false },
        { $set: { isRead: true, readAt: now } },
        { new: true },
      );
      if (row) return publicNotice(row, req.user, now);
      const existing = await model
        .findOne(scope)
        .select(
          "type title message priority isRead createdAt readAt actionUrl actionLabel metadata",
        )
        .lean();
      if (!existing) throw new NotFoundError("Notification not found");
      return publicNotice(existing, req.user, now);
    },
    async markAllRead(req) {
      const now = clock();
      const range = validateDateRange(req.query, now);
      const result = await model.updateMany(
        {
          ...inboxScope(req, now),
          isRead: false,
          ...(range
            ? { createdAt: { $gte: range.start, $lt: range.end } }
            : {}),
        },
        { $set: { isRead: true, readAt: now } },
      );
      return { modifiedCount: result.modifiedCount };
    },
  };
}
module.exports = { createInboxService, inboxScope, parseOptions, publicNotice };
