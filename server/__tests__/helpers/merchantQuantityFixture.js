"use strict";
const mongoose = require("mongoose");
async function fixture({ cost = 0, orderId, shippingFee = 0 } = {}) {
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
      name: "Quantity fixture",
      code: "QTY",
      isActive: true,
    });
    await Channel.create({
      tenant,
      apiKey: oid(),
      warehouse: location,
      code: `QUANTITY_${index}`,
      paymentAccount: `QUANTITY_${index}`,
      returnOrigins: ["https://quantity.example.test"],
      enabled: false,
      configuredBy: admin,
    });
    await Product.collection.insertOne({
      _id: product,
      name: "Quantity bottle",
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
    for (const quantity of index === 0 ? [3, 2] : [2])
      items.push({
        product,
        subproduct,
        size,
        tenant,
        quantity,
        priceAtPurchase: 10,
        vendorPriceAtPurchase: cost,
        itemSubtotal: 10 * quantity,
        discountAmount: 0,
        tenantRevenueShare: 8 * quantity,
        platformCommission: 2 * quantity,
      });
  }
  const order =
    await require("../../services/storefrontLocationOrders").createMappedOrder(
      {
        ...(orderId ? { _id: orderId } : {}),
        user: customer,
        orderNumber: "QUANTITY-" + oid(),
        currency: "NGN",
        subtotal: 70,
        discountTotal: 0,
        shippingFee,
        taxAmount: 0,
        totalAmount: 70 + shippingFee,
        items,
        paymentMethod: "card",
        paymentStatus: "paid",
        paymentDetails: { method: "stripe", reference: "pi_quantity_" + oid() },
        status: "confirmed",
        shippingAddress: {
          fullName: "Own buyer",
          email: "q@example.test",
          addressLine1: "Synthetic address",
          city: "Abuja",
          state: "FCT",
          country: "Nigeria",
        },
      },
      tenants,
    );
  return {
    order,
    actors,
    tenants,
    admin: { _id: admin, role: "super_admin" },
    customer,
  };
}
module.exports = { fixture };
