const Statement = require("../models/CustomerAccountStatement");

// Display-only FIFO allocation of unallocated tab repayments, across the entire
// customer ledger before applying invoice date/status/page filters. No writes.
function posInvoiceBalanceStages(tenant) {
  return [
    {
      $lookup: {
        from: Statement.collection.name,
        let: {
          customer: "$paymentDetails.customer.customerId",
          receipt: "$receiptNumber",
          charge: { $ifNull: ["$paymentDetails.accountCharge", 0] },
        },
        pipeline: [
          {
            $match: {
              tenant,
              voided: false,
              $expr: {
                $and: [
                  { $gt: ["$$charge", 0] },
                  { $ne: ["$$customer", null] },
                  { $eq: ["$customer", "$$customer"] },
                ],
              },
            },
          },
          {
            $group: {
              _id: "$receiptNumber",
              charges: {
                $sum: {
                  $cond: [{ $eq: ["$entryType", "charge"] }, "$amount", 0],
                },
              },
              credits: {
                $sum: {
                  $cond: [{ $eq: ["$entryType", "credit"] }, "$amount", 0],
                },
              },
              payments: {
                $sum: {
                  $cond: [{ $eq: ["$entryType", "payment"] }, "$amount", 0],
                },
              },
              firstAt: { $min: "$occurredAt" },
            },
          },
          { $sort: { firstAt: 1, _id: 1 } },
          {
            $group: {
              _id: null,
              payments: { $sum: "$payments" },
              rows: {
                $push: {
                  receipt: "$_id",
                  charges: "$charges",
                  net: { $max: [0, { $subtract: ["$charges", "$credits"] }] },
                },
              },
            },
          },
          {
            $project: {
              allocation: {
                $reduce: {
                  input: "$rows",
                  initialValue: {
                    remaining: "$payments",
                    matched: false,
                    outstanding: 0,
                  },
                  in: {
                    remaining: {
                      $max: [
                        0,
                        { $subtract: ["$$value.remaining", "$$this.net"] },
                      ],
                    },
                    matched: {
                      $or: [
                        "$$value.matched",
                        {
                          $and: [
                            { $eq: ["$$this.receipt", "$$receipt"] },
                            { $gt: ["$$this.charges", 0] },
                          ],
                        },
                      ],
                    },
                    outstanding: {
                      $cond: [
                        { $eq: ["$$this.receipt", "$$receipt"] },
                        {
                          $max: [
                            0,
                            { $subtract: ["$$this.net", "$$value.remaining"] },
                          ],
                        },
                        "$$value.outstanding",
                      ],
                    },
                  },
                },
              },
            },
          },
          {
            $project: {
              outstanding: {
                $cond: [
                  "$allocation.matched",
                  "$allocation.outstanding",
                  "$$charge",
                ],
              },
            },
          },
        ],
        as: "accountLedger",
      },
    },
    {
      $set: {
        accountOutstanding: {
          $ifNull: [
            { $arrayElemAt: ["$accountLedger.outstanding", 0] },
            { $ifNull: ["$paymentDetails.accountCharge", 0] },
          ],
        },
      },
    },
  ];
}
module.exports = { posInvoiceBalanceStages };
