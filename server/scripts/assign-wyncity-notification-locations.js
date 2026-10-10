// Preview audited current notification assignments; --apply performs a scoped transaction.
const path = require("node:path");
const fs = require("node:fs");
require("dotenv").config({
  path: path.resolve(__dirname, "../.env"),
  quiet: true,
});
const mongoose = require("mongoose");
const { assignmentPlan } = require("../services/warehouseAssignmentPlan");
if (process.env.NODE_DNS_SERVERS?.trim())
  require("node:dns").promises.setServers(
    process.env.NODE_DNS_SERVERS.split(",").map((s) => s.trim()),
  );
const id = (value) => String(value || "");
const manifest = fs
  .readFileSync(
    path.resolve(
      __dirname,
      "../../docs/reports/wyncity-notification-assignments-2026-10-09.md",
    ),
    "utf8",
  )
  .split("\n")
  .filter((line) =>
    /^\| .+ \| [a-f0-9]{24} \| [a-f0-9]{24} \| (yes|no) \|$/.test(line),
  )
  .map((line) => {
    const cells = line.split("|").map((s) => s.trim());
    return { productId: cells[2], sizeId: cells[3], stock: cells[4] === "yes" };
  });
async function main() {
  if (
    process.argv.slice(2).some((arg) => arg !== "--apply") ||
    manifest.length !== 172 ||
    new Set(manifest.map((row) => row.productId)).size !== 171
  )
    throw Error("Use this audited manifest only, optionally with --apply");
  const apply = process.argv.includes("--apply");
  await mongoose.connect(process.env.MONGODB_URI, {
    autoIndex: false,
    autoCreate: false,
    maxPoolSize: 1,
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db,
    session = await mongoose.startSession();
  let output;
  try {
    await session.withTransaction(async () => {
      const options = { session };
      const tenant = await db
        .collection("tenants")
        .findOne({ slug: "wyncity", status: "approved" }, options);
      if (id(tenant?._id) !== "699165839f3308b1baeca8fc")
        throw Error("Audited tenant unavailable");
      const warehouses = await db
        .collection("warehouses")
        .find(
          { tenant: tenant._id, name: /^Wyn City$/i, isActive: { $ne: false } },
          options,
        )
        .toArray();
      if (
        warehouses.length !== 1 ||
        id(warehouses[0]._id) !== "6a32ad2c78f1e3c27bda089a"
      )
        throw Error("Audited Wyn City warehouse unavailable");
      const warehouse = warehouses[0],
        scope = { tenant: tenant._id };
      const productIds = [...new Set(manifest.map((row) => row.productId))].map(
        (v) => new mongoose.Types.ObjectId(v),
      );
      const products = await db
        .collection("subproducts")
        .find({ ...scope, _id: { $in: productIds } }, options)
        .toArray();
      const sizes = await db
        .collection("sizes")
        .find({ ...scope, subproduct: { $in: productIds } }, options)
        .toArray();
      const beforeStock = await db
        .collection("warehousestocks")
        .find(scope, options)
        .toArray();
      const plan = assignmentPlan({
        tenantId: tenant._id,
        warehouse,
        manifest,
        products,
        sizes,
        stocks: beforeStock,
      });
      const created = [],
        changed = new Map(),
        now = new Date();
      if (apply) {
        if (plan.defaults.length) {
          const result = await db.collection("subproducts").bulkWrite(
            plan.defaults.map((product) => ({
              updateOne: {
                filter: {
                  ...scope,
                  _id: product._id,
                  warehouse: product.warehouse || null,
                },
                update: { $set: { warehouse: warehouse._id, updatedAt: now } },
              },
            })),
            options,
          );
          if (result.matchedCount !== plan.defaults.length)
            throw Error("Product warehouse changed concurrently");
        }
        for (const product of plan.defaults)
          changed.set(id(product._id), {
            beforeWarehouse: product.warehouse || null,
            stockIds: [],
          });
        const newRows = plan.stock.map((row) => {
          const _id = new mongoose.Types.ObjectId();
          created.push(id(_id));
          const record = changed.get(id(row.subProduct)) || {
            beforeWarehouse:
              products.find((p) => id(p._id) === id(row.subProduct))
                .warehouse || null,
            stockIds: [],
          };
          record.stockIds.push(_id);
          changed.set(id(row.subProduct), record);
          return { ...row, _id, createdAt: now, updatedAt: now, __v: 0 };
        });
        if (newRows.length)
          await db.collection("warehousestocks").insertMany(newRows, options);
        const audits = [...changed].map(([productId, record]) => ({
          actorRole: "system",
          action: "SUBPRODUCT_WAREHOUSE_ASSIGN",
          actionCategory: "update",
          targetType: "SubProduct",
          targetId: new mongoose.Types.ObjectId(productId),
          targetTenantId: tenant._id,
          justification:
            "Explicit user request: assign unassigned Wyn City tenant products to Wyn City warehouse.",
          changes: {
            before: { warehouse: record.beforeWarehouse },
            after: {
              warehouse: warehouse._id,
              createdStockRowIds: record.stockIds,
              createdQuantity: 0,
              manifest: "wyncity-notification-assignments-2026-10-09.md",
            },
          },
          result: "success",
          timestamp: now,
        }));
        if (audits.length)
          await db.collection("auditlogs").insertMany(audits, options);
        const afterStock = await db
          .collection("warehousestocks")
          .find(scope, options)
          .toArray();
        const afterMap = new Map(afterStock.map((row) => [id(row._id), row]));
        if (
          afterStock.length !== beforeStock.length + created.length ||
          beforeStock.some((row) => {
            const after = afterMap.get(id(row._id));
            return (
              !after ||
              after.currentQuantity !== row.currentQuantity ||
              after.reservedQuantity !== row.reservedQuantity ||
              id(after.warehouse) !== id(row.warehouse)
            );
          }) ||
          created.some((stockId) => {
            const row = afterMap.get(stockId);
            return (
              row.currentQuantity !== 0 ||
              row.reservedQuantity !== 0 ||
              id(row.warehouse) !== id(warehouse._id)
            );
          })
        )
          throw Error("Stock balance preservation failed");
        const assigned = await db
          .collection("subproducts")
          .countDocuments(
            { ...scope, _id: { $in: productIds }, warehouse: warehouse._id },
            options,
          );
        if (assigned !== 171) throw Error("Product assignment readback failed");
        const reloaded = await db
          .collection("subproducts")
          .find({ ...scope, _id: { $in: productIds } }, options)
          .toArray();
        const repeat = assignmentPlan({
          tenantId: tenant._id,
          warehouse,
          manifest,
          products: reloaded,
          sizes,
          stocks: afterStock,
        });
        if (repeat.defaults.length || repeat.stock.length)
          throw Error("Assignment rerun verification failed");
      }
      output = {
        mode: apply ? "apply" : "preview",
        tenant: tenant.slug,
        warehouse: warehouse.name,
        manifestProducts: 171,
        missingProductDefaults: plan.defaults.length,
        newZeroStockRows: plan.stock.length,
        auditRecords: apply ? changed.size : 0,
        quantitiesPreserved: apply,
        readbackVerified: apply,
        historicalSalesChanged: false,
      };
    });
    console.log(JSON.stringify(output));
  } finally {
    await session.endSession();
  }
}
main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
