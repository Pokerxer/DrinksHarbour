const mongoose = require("mongoose");
const Order = require("../../models/Order");
const { bad, dateRange, escapeSearch } = require("../accounting.query");
const { sourcePipelines } = require("./sources");
const { evidencePipeline } = require("./evidence");
function validated(filters = {}) {
  const { source, disposition, search, warehouse, from, to } = filters;
  if (filters.invoice && !mongoose.isValidObjectId(filters.invoice))
    throw bad("Invalid invoice");
  if (source && !["sales", "pos"].includes(source))
    throw bad("Invalid return source");
  if (
    disposition &&
    !["restocked", "not-restocked", "unverified"].includes(disposition)
  )
    throw bad("Invalid stock disposition");
  if (warehouse && !mongoose.isValidObjectId(warehouse))
    throw bad("Invalid location");
  const page = Number(filters.page ?? 1),
    limit = Number(filters.limit ?? 25);
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 100
  )
    throw bad("Invalid return pagination");
  const match = {};
  if (source) match.source = source;
  if (disposition === "restocked") match.restocked = { $gt: 0 };
  if (disposition === "not-restocked") match.notRestocked = { $gt: 0 };
  if (disposition === "unverified") match.stockEvidence = "unverified";
  const range = dateRange({ from, to });
  if (range) match.date = range;
  if (search) {
    const rx = new RegExp(escapeSearch(search), "i");
    match.$or = ["sourceNumber", "reference", "product", "reason"].map(
      (key) => ({ [key]: rx }),
    );
  }
  return { page, limit, match, warehouse };
}
async function listCustomerReturns(tenantId, filters = {}) {
  if (!tenantId || !mongoose.isValidObjectId(tenantId))
    throw Object.assign(new Error("Tenant context required"), {
      statusCode: 403,
      status: 403,
    });
  const { page, limit, match, warehouse } = validated(filters);
  const tenant = new mongoose.Types.ObjectId(String(tenantId));
  const { sales, pos } = sourcePipelines(tenant);
  const invoiceScope = filters.invoice
    ? await require("../customerInvoice/returns").inventoryInvoiceScope(
        tenant,
        filters.invoice,
      )
    : null;
  const locationFilter = warehouse
    ? [
        {
          $match: {
            "destinations._id": new mongoose.Types.ObjectId(warehouse),
          },
        },
      ]
    : [];
  const [results, issuer] = await Promise.all([
    Order.aggregate([
      ...pos,
      { $unionWith: { coll: "salesorders", pipeline: sales } },
      ...evidencePipeline(tenant),
      ...(invoiceScope ? [{ $match: invoiceScope.match }] : []),
      { $match: match },
      {
        $facet: {
          locations: [
            { $unwind: "$destinations" },
            {
              $group: {
                _id: "$destinations._id",
                name: { $first: "$destinations.name" },
              },
            },
            { $sort: { name: 1 } },
          ],
          rows: [
            ...locationFilter,
            { $sort: { date: -1, id: 1 } },
            { $skip: (page - 1) * limit },
            { $limit: limit },
            { $unset: "warehouseId" },
          ],
          summary: [
            ...locationFilter,
            {
              $group: {
                _id: null,
                count: { $sum: 1 },
                returned: { $sum: "$returned" },
                restocked: { $sum: "$restocked" },
                notRestocked: { $sum: "$notRestocked" },
                unverified: {
                  $sum: {
                    $cond: [{ $eq: ["$stockEvidence", "unverified"] }, 1, 0],
                  },
                },
              },
            },
          ],
        },
      },
    ]).allowDiskUse(true),
    require("../../models/Tenant")
      .findOne({ _id: tenant })
      .select("name address")
      .lean(),
  ]);
  const result = results[0];
  const summary = result?.summary[0] || {
    count: 0,
    returned: 0,
    restocked: 0,
    notRestocked: 0,
    unverified: 0,
  };
  delete summary._id;
  return {
    rows: result?.rows || [],
    total: summary.count,
    page,
    pages: Math.max(1, Math.ceil(summary.count / limit)),
    summary,
    locations: result?.locations || [],
    invoiceContext: invoiceScope?.invoiceContext,
    issuer: issuer
      ? { name: issuer.name, address: issuer.address }
      : { name: "DrinksHarbour" },
  };
}
module.exports = { listCustomerReturns, validated };
