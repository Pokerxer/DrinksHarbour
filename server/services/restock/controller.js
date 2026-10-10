const asyncHandler = require("express-async-handler");
const { access, validateOptions, publicPlan } = require("./access");
const { getPlan } = require("./service");
const { ForbiddenError } = require("../../utils/errors");
function planningController(
  service = getPlan,
  sync = (...args) =>
    require("./notifications").syncForecastNotifications(...args),
) {
  const handler = (kind) =>
    asyncHandler(async (req, res) => {
      const a = access(req.user),
        options = validateOptions(req.query);
      if (
        kind === "purchase"
          ? !a.purchase
          : kind === "demand"
            ? !a.reports
            : !a.inventory
      )
        throw new ForbiddenError("Planning access unavailable");
      const tenantId = String(req.user.tenant?._id || req.user.tenant);
      const plan = await service(tenantId, {
        ...options,
        purchasing: kind === "purchase",
        includeSales: a.reports,
        updateMinimum: a.inventory && a.purchase && !options.startDate,
      });
      if (
        a.inventory &&
        a.reports &&
        !options.startDate &&
        !options.warehouseId &&
        !options.subProductId &&
        !options.sizeId
      )
        await sync(tenantId, plan, new Date(), req.user._id);
      const filtered = {
        ...plan,
        lines: plan.lines.filter(
          (l) =>
            (!options.subProductId ||
              l.subProductId === options.subProductId) &&
            (!options.sizeId || l.sizeId === options.sizeId),
        ),
      };
      if (plan.summaries)
        filtered.summaries = plan.summaries.filter(
          (l) =>
            (!options.subProductId ||
              l.subProductId === options.subProductId) &&
            (!options.sizeId || l.sizeId === options.sizeId),
        );
      if (plan.groups) {
        const visible = new Map(filtered.lines.map((line) => [line.key, line]));
        filtered.groups = plan.groups
          .map((group) => {
            const lineKeys = group.lineKeys.filter((key) => visible.has(key));
            return {
              ...group,
              lineKeys,
              estimatedCost:
                Math.round(
                  lineKeys.reduce(
                    (n, key) =>
                      n + (visible.get(key).selected?.estimatedCost || 0),
                    0,
                  ) * 100,
                ) / 100,
            };
          })
          .filter((group) => group.lineKeys.length);
      }
      res.json({
        success: true,
        data: {
          ...publicPlan(filtered, { ...a, purchase: kind === "purchase" }),
          canManageTransfers: a.inventory && a.purchase,
          canReviewRestock: a.inventory && a.purchase,
        },
      });
    });
  return {
    warehouseRisk: handler("stock"),
    demand: handler("demand"),
    orderPlan: handler("purchase"),
  };
}
module.exports = { planningController };
