'use strict';
// Zero-only release fixture — mirrors merchantQuantityFixture but includes a
// zero-merchandise line for tenant 0 (itemSubtotal 0, zero revenue shares) so
// zero-value unit ranges exist without any positive refund. Synthetic only.
const mongoose = require("mongoose");
async function fixture({ cost = 0, shippingFee = 0, orderId } = {}) {
  const oid = () => new mongoose.Types.ObjectId(),
    User = require("../../models/User"),
    Tenant = require("../../models/Tenant"),
    Warehouse = require("../../models/Warehouse"),
    Product = require("../../models/Product"),
    Sub = require("../../models/SubProduct"),
    Size = require("../../models/Size"),
    Stock = require("../../models/WarehouseStock"),
    Batch = require("../../models/WarehouseBatch"),
    Channel = require("../../models/StorefrontChannel");
  const customer = oid(),
    admin = oid(),
    actors = [],
    tenants = [],
    items = [];
  await User.collection.insertMany([
    { _id: customer, role: "customer", status: "active" },
    { _id: admin, role: "super_admin", status: "active" },
  ]);
  for (let index = 0; index < 2; index++) {
    const tenant = oid(),
      location = oid(),
      product = oid(),
      subproduct = oid(),
      size = oid(),
      actor = oid();
    actors.push({ _id: actor, role: "tenant_owner", tenant });
    tenants.push({ _id: tenant, storefrontIntegrationEnabled: true });
    await Tenant.collection.insertOne({
      _id: tenant,
      status: "approved",
      subscriptionStatus: "active",
    });
    await User.collection.insertOne({
      _id: actor,
      tenant,
      role: "tenant_owner",
      status: "active",
    });
    await Warehouse.create({
      _id: location,
      tenant,
      name: "Zero release fixture",
      code: "ZRO",
      isActive: true,
    });
    await Channel.create({
      tenant,
      apiKey: oid(),
      warehouse: location,
      code: `ZERO_${index}`,
      paymentAccount: `ZERO_${index}`,
      returnOrigins: ["https://zero.example.test"],
      enabled: false,
      configuredBy: admin,
    });
    await Product.collection.insertOne({
      _id: product,
      name: "Zero release bottle",
      tracksBatch: true,
    });
    await Sub.collection.insertOne({
      _id: subproduct,
      tenant,
      product,
      totalStock: 10,
      availableStock: 10,
    });
    await Size.collection.insertOne({
      _id: size,
      tenant,
      subproduct,
      stock: 10,
      availableStock: 10,
    });
    await Stock.create({
      tenant,
      warehouse: location,
      subProduct: subproduct,
      size,
      currentQuantity: 10,
      reservedQuantity: 0,
    });
    await Batch.create([
      {
        tenant,
        warehouse: location,
        subProduct: subproduct,
        size,
        product,
        batchNumber: "EARLY",
        quantity: 2,
        initialQuantity: 2,
        unitCost: 0,
        expiryDate: new Date("2031-01-01"),
      },
      {
        tenant,
        warehouse: location,
        subProduct: subproduct,
        size,
        product,
        batchNumber: "LATER",
        quantity: 8,
        initialQuantity: 8,
        unitCost: 0,
        expiryDate: new Date("2032-01-01"),
      },
    ]);
    // Tenant 0: one positive-merchandise line of 3 units (₦10/unit → 3000
    // minor, 2400/600 split) and one ZERO-merchandise line of 2 units.
    // Tenant 1: one positive line of 2 units.
    const lines =
      index === 0
        ? [
            { quantity: 3, subtotal: 30, share: 24, commission: 6 },
            { quantity: 2, subtotal: 0, share: 0, commission: 0 },
          ]
        : [{ quantity: 2, subtotal: 20, share: 16, commission: 4 }];
    for (const line of lines)
      items.push({
        product,
        subproduct,
        size,
        tenant,
        quantity: line.quantity,
        priceAtPurchase: line.subtotal / line.quantity,
        vendorPriceAtPurchase: cost,
        itemSubtotal: line.subtotal,
        discountAmount: 0,
        tenantRevenueShare: line.share,
        platformCommission: line.commission,
      });
  }
  const order =
    await require("../../services/storefrontLocationOrders").createMappedOrder(
      {
        ...(orderId ? { _id: orderId } : {}),
        user: customer,
        orderNumber: "ZERO-" + oid(),
        currency: "NGN",
        subtotal: 50,
        discountTotal: 0,
        shippingFee,
        taxAmount: 0,
        totalAmount: 50 + shippingFee,
        items,
        paymentMethod: "card",
        paymentStatus: "paid",
        paymentDetails: { method: "stripe", reference: "pi_zero_" + oid() },
        status: "confirmed",
        shippingAddress: {
          fullName: "Zero buyer",
          email: "zero@example.test",
          addressLine1: "Synthetic address",
          city: "Abuja",
          state: "FCT",
          country: "Nigeria",
        },
      },
      tenants,
    );
  return { order, actors, tenants, admin: { _id: admin, role: "super_admin" }, customer };
}
module.exports = { fixture };
