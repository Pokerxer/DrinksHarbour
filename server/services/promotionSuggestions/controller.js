const asyncHandler = require("express-async-handler");
const { effectivePermissions } = require("../effectivePermissions.service");
const { access } = require("../restock/access");
const { getTenantId } = require("../../utils/tenantContext");
const { ForbiddenError } = require("../../utils/errors");
const { options } = require("./options");
const { readSuggestions } = require("./reader");
const { planSuggestions } = require("./planner");
function promotionSuggestionsController(
  reader = readSuggestions,
  clock = () => new Date(),
) {
  return asyncHandler(async (req, res) => {
    access(req.user);
    const permissions = effectivePermissions(req.user);
    if (
      !permissions.includes("reports:read") ||
      !permissions.includes("inventory:read") ||
      !permissions.includes("subproducts:read")
    )
      throw new ForbiddenError(
        "Sales, inventory and product access are required.",
      );
    const tenantId = getTenantId(req),
      now = clock(),
      opts = options(req.query, now);
    const canPrice = ["tenant_owner", "tenant_admin"].includes(req.user.role);
    const evidence = await reader(tenantId, opts, now, canPrice);
    const result = planSuggestions({ ...evidence, ...opts, now, canPrice });
    res.json({
      success: true,
      data: {
        ...result,
        generatedAt: now.toISOString(),
        warehouses: evidence.warehouses,
        warnings: evidence.warnings,
        historyStart: evidence.start,
        historyEnd: evidence.end,
        days: evidence.days,
      },
    });
  });
}
module.exports = { promotionSuggestionsController };
