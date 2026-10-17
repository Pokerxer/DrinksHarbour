const mongoose = require("mongoose");
const Order = require("../../models/Order");
const { sourcePipelines } = require("../customerReturns/sources");
const { bad } = require("../accounting.query");
const id = (value) => String(value?._id || value || "");
function normalizeReturn(row) {
  const items = (row.invoice.items || []).filter(
    (item) =>
      (!item.lineType || item.lineType === "product") && item.quantity > 0,
  );
  const soldUnits = items.reduce((n, item) => n + item.quantity, 0);
  const recordedUnits = row.lines.reduce((n, line) => n + line.returned, 0);
  let needsReview = soldUnits <= 0 || recordedUnits > soldUnits;
  const lines = row.lines.map((line) => {
    const matches = items.filter(
      (item) =>
        id(item.subproduct) === id(line.subproduct) &&
        (!item.size || id(item.size) === id(line.size)),
    );
    if (matches.length !== 1) needsReview = true;
    return {
      source: line.source,
      sourceId: line.sourceId,
      sourceNumber: line.sourceNumber,
      reference: line.reference,
      product:
        matches.length === 1
          ? matches[0].name
          : line.product || "Unmatched returned item",
      returned: line.returned,
    };
  });
  return {
    status: needsReview
      ? "review"
      : recordedUnits >= soldUnits
        ? "full"
        : "partial",
    returnedUnits: Math.min(recordedUnits, soldUnits),
    recordedUnits,
    soldUnits,
    needsReview,
    refundRecorded: row.lines.some((line) => line.refundRecorded),
    lines: lines.slice(0, 50),
    truncated: lines.length > 50,
  };
}
async function invoiceReturnMap(tenantId, invoiceIds) {
  const tenant = new mongoose.Types.ObjectId(String(tenantId));
  const { pos, sales } = sourcePipelines(tenant);
  const selected = invoiceIds
    ? {
        _id: {
          $in: invoiceIds.map(
            (value) => new mongoose.Types.ObjectId(String(value)),
          ),
        },
      }
    : {};
  const rows = await Order.aggregate([
    ...pos,
    { $unionWith: { coll: "salesorders", pipeline: sales } },
    {
      $lookup: {
        from: "salesorders",
        localField: "linkedSalesOrder",
        foreignField: "_id",
        pipeline: [
          { $match: { tenant } },
          { $project: { docType: 1, convertedTo: 1 } },
        ],
        as: "linked",
      },
    },
    { $set: { linked: { $arrayElemAt: ["$linked", 0] } } },
    {
      $set: {
        canonicalSource: {
          $cond: [
            {
              $or: [
                { $eq: ["$source", "sales"] },
                { $ne: [{ $ifNull: ["$linkedSalesOrder", null] }, null] },
              ],
            },
            "sales",
            "pos",
          ],
        },
        canonicalId: {
          $cond: [
            { $eq: ["$source", "sales"] },
            "$sourceId",
            {
              $cond: [
                { $ne: [{ $ifNull: ["$linkedSalesOrder", null] }, null] },
                {
                  $cond: [
                    { $eq: ["$linked.docType", "quotation"] },
                    "$linked.convertedTo",
                    "$linked._id",
                  ],
                },
                "$sourceId",
              ],
            },
          ],
        },
      },
    },
    {
      $lookup: {
        from: "customerinvoices",
        let: { source: "$canonicalSource", sourceId: "$canonicalId" },
        pipeline: [
          {
            $match: {
              tenant,
              ...selected,
              $expr: {
                $and: [
                  { $eq: ["$source", "$$source"] },
                  { $eq: ["$sourceId", "$$sourceId"] },
                ],
              },
            },
          },
          { $project: { items: 1 } },
        ],
        as: "invoice",
      },
    },
    { $unwind: "$invoice" },
    {
      $group: {
        _id: "$invoice._id",
        invoice: { $first: "$invoice" },
        lines: {
          $push: {
            source: "$source",
            sourceId: "$sourceId",
            sourceNumber: "$sourceNumber",
            reference: "$reference",
            product: "$product",
            subproduct: "$subproductId",
            size: "$sizeId",
            returned: "$returned",
            refundRecorded: "$refundRecorded",
          },
        },
      },
    },
  ]).allowDiskUse(true);
  return new Map(rows.map((row) => [id(row._id), normalizeReturn(row)]));
}
const noReturns = {
  status: "none",
  returnedUnits: 0,
  recordedUnits: 0,
  soldUnits: 0,
  needsReview: false,
  refundRecorded: false,
  lines: [],
  truncated: false,
};
function returnFilter(map, status) {
  if (!status) return {};
  if (!["none", "partial", "full", "returned", "review"].includes(status))
    throw bad("Invalid invoice return status");
  const matching = [...map]
    .filter(([, summary]) => status === "returned" || summary.status === status)
    .map(([key]) => new mongoose.Types.ObjectId(key));
  return {
    _id:
      status === "none"
        ? {
            $nin: [...map.keys()].map(
              (key) => new mongoose.Types.ObjectId(key),
            ),
          }
        : { $in: matching },
  };
}
module.exports = { invoiceReturnMap, normalizeReturn, noReturns, returnFilter };
async function inventoryInvoiceScope(tenant, invoiceId) {
  if (!mongoose.isValidObjectId(invoiceId)) throw bad("Invalid invoice");
  const invoice = await require("../../models/CustomerInvoice")
    .findOne({ _id: invoiceId, tenant })
    .select("source sourceId number")
    .lean();
  if (!invoice) throw bad("Invoice not found");
  let receipts = [];
  if (invoice.source === "sales") {
    const source = await require("../../models/SalesOrder")
      .findOne({ _id: invoice.sourceId, tenant })
      .select("convertedFrom")
      .lean();
    receipts = await Order.find({
      tenant,
      source: "pos",
      linkedSalesOrder: {
        $in: [invoice.sourceId, source?.convertedFrom].filter(Boolean),
      },
    })
      .select("_id")
      .lean();
  }
  return {
    invoiceContext: { id: String(invoice._id), number: invoice.number },
    match:
      invoice.source === "pos"
        ? { source: "pos", sourceId: invoice.sourceId }
        : {
            $or: [
              { source: "sales", sourceId: invoice.sourceId },
              {
                source: "pos",
                sourceId: { $in: receipts.map((row) => row._id) },
              },
            ],
          },
  };
}
module.exports.inventoryInvoiceScope = inventoryInvoiceScope;
