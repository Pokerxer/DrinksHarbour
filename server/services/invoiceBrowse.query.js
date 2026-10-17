const mongoose = require("mongoose");
const Order = require("../models/Order");
const SalesOrder = require("../models/SalesOrder");
const POSCustomer = require("../models/POSCustomer");
const { bad, dateRange, escapeSearch } = require("./accounting.query");

const salesEligibility = {
  docType: "order",
  orderStatus: { $ne: "cancelled" },
  currency: { $in: ["NGN", null] },
  $or: [
    { orderStatus: { $in: ["confirmed", "partially_fulfilled", "fulfilled"] } },
    { paymentStatus: "paid" },
    { amountPaid: { $gt: 0 } },
  ],
};
const zero = (field) => ({ $ifNull: [field, 0] });

function invoicePipeline(
  tenantId,
  { status, from, to, search, page = 1, limit = 25 } = {},
  posBalanceStages = [],
) {
  const tenant = new mongoose.Types.ObjectId(String(tenantId));
  if (status && !["paid", "unpaid", "partial", "open"].includes(status))
    throw bad("Invalid invoice status");
  const pipeline = [
    { $match: { tenant, ...salesEligibility } },
    {
      $project: {
        _id: 1,
        source: { $literal: "sales" },
        orderNumber: "$soNumber",
        date: "$createdAt",
        dueDate: 1,
        customer: 1,
        customerSnapshot: 1,
        total: zero("$total"),
        amountPaid: zero("$amountPaid"),
        creditedAmount: zero("$creditedAmount"),
        orderStatus: 1,
      },
    },
    {
      $unionWith: {
        coll: Order.collection.name,
        pipeline: [
          {
            $match: {
              tenant,
              source: "pos",
              currency: { $in: ["NGN", null] },
              isVoided: { $ne: true },
              status: { $nin: ["hold", "cancelled", "refunded", "recalled"] },
              $or: [
                { paymentStatus: { $in: ["paid", "partially_refunded"] } },
                { status: "delivered" },
              ],
            },
          },
          // Show the canonical Sales invoice once when a receipt belongs to it.
          {
            $lookup: {
              from: SalesOrder.collection.name,
              localField: "linkedSalesOrder",
              foreignField: "_id",
              pipeline: [
                { $match: { tenant, ...salesEligibility } },
                { $project: { _id: 1 } },
              ],
              as: "linkedInvoice",
            },
          },
          { $match: { "linkedInvoice.0": { $exists: false } } },
          ...posBalanceStages,
          {
            $set: {
              invoiceRefund: {
                $max: [
                  { $sum: "$refunds.totalRefunded" },
                  zero("$refundDetails.amount"),
                ],
              },
            },
          },
          {
            $project: {
              _id: 1,
              source: { $literal: "pos" },
              orderNumber: { $ifNull: ["$receiptNumber", "$orderNumber"] },
              date: { $ifNull: ["$placedAt", "$createdAt"] },
              orderStatus: "$status",
              customer: "$paymentDetails.customer.customerId",
              customerSnapshot: {
                name: {
                  $trim: {
                    input: {
                      $concat: [
                        {
                          $ifNull: [
                            "$paymentDetails.customer.firstName",
                            "Walk-in",
                          ],
                        },
                        " ",
                        {
                          $ifNull: [
                            "$paymentDetails.customer.lastName",
                            "customer",
                          ],
                        },
                      ],
                    },
                  },
                },
                customerId: "$paymentDetails.customer.customerId",
              },
              total: zero("$totalAmount"),
              creditedAmount: zero("$invoiceRefund"),
              amountPaid: {
                $cond: [
                  { $in: ["$paymentStatus", ["paid", "partially_refunded"]] },
                  {
                    $max: [
                      0,
                      {
                        $subtract: [
                          {
                            $subtract: [
                              zero("$totalAmount"),
                              zero("$invoiceRefund"),
                            ],
                          },
                          {
                            $ifNull: [
                              "$accountOutstanding",
                              zero("$paymentDetails.accountCharge"),
                            ],
                          },
                        ],
                      },
                    ],
                  },
                  0,
                ],
              },
            },
          },
        ],
      },
    },
    {
      $set: {
        outstanding: {
          $max: [
            0,
            {
              $round: [
                {
                  $subtract: [
                    "$total",
                    { $add: ["$amountPaid", "$creditedAmount"] },
                  ],
                },
                2,
              ],
            },
          ],
        },
      },
    },
    {
      $set: {
        paymentStatus: {
          $cond: [
            { $lte: ["$outstanding", 0] },
            "paid",
            {
              $cond: [
                { $gt: [{ $add: ["$amountPaid", "$creditedAmount"] }, 0] },
                "partial",
                "unpaid",
              ],
            },
          ],
        },
      },
    },
  ];
  const filter = {};
  if (status === "open") filter.outstanding = { $gt: 0 };
  else if (status) filter.paymentStatus = status;
  const range = dateRange({ from, to });
  if (range) filter.date = range;
  if (search) {
    const rx = new RegExp(escapeSearch(search), "i");
    filter.$or = [{ orderNumber: rx }, { "customerSnapshot.name": rx }];
  }
  if (Object.keys(filter).length) pipeline.push({ $match: filter });
  pipeline.push(
    { $sort: { date: -1, _id: -1, source: 1 } },
    {
      $facet: {
        data: [
          { $skip: (page - 1) * limit },
          { $limit: limit },
          {
            $lookup: {
              from: POSCustomer.collection.name,
              localField: "customer",
              foreignField: "_id",
              pipeline: [
                { $match: { tenant } },
                { $project: { firstName: 1, lastName: 1 } },
              ],
              as: "customer",
            },
          },
          {
            $set: {
              customer: { $ifNull: [{ $arrayElemAt: ["$customer", 0] }, null] },
            },
          },
        ],
        count: [{ $count: "total" }],
      },
    },
  );
  return pipeline;
}
module.exports = { invoicePipeline };
