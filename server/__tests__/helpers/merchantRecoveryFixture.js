'use strict';
async function fixture(t) {
  const flags = [
      'MERCHANT_FULFILLMENT_ENABLED',
      'MERCHANT_QUANTITY_FULFILLMENT_ENABLED',
      'MERCHANT_LOCAL_DISPATCH_ENABLED',
    ],
    previous = flags.map((k) => process.env[k]);
  flags.forEach((k) => (process.env[k] = 'true'));
  t.after(() =>
    flags.forEach((k, i) =>
      previous[i] === undefined
        ? delete process.env[k]
        : (process.env[k] = previous[i])
    )
  );
  const { fixture } = require('./merchantQuantityFixture'),
    f = await fixture(),
    Child = require('../../models/MerchantOrder'),
    Order = require('../../models/Order'),
    Driver = require('../../models/Driver'),
    Stock = require('../../models/WarehouseStock'),
    Hold = require('../../models/OnlineStockReservation');
  const child = await Child.findOne({
      order: f.order._id,
      tenant: f.actors[0].tenant,
    }).lean(),
    other = await Child.findOne({
      order: f.order._id,
      tenant: f.actors[1].tenant,
    }).lean(),
    actor = f.actors[0];
  await Order.collection.updateOne(
    { _id: f.order._id },
    {
      $set: {
        shippingMethod: 'standard',
        'shippingAddress.coordinates': { latitude: 9.05, longitude: 7.4 },
      },
    }
  );
  for (const line of child.lines) {
    await require('../../models/Product').collection.updateOne(
      { _id: line.product },
      { $set: { type: 'soft_drink', isAlcoholic: false } }
    );
    await require('../../models/SubProduct').collection.updateOne(
      { _id: line.subproduct },
      {
        $set: {
          shipping: {
            fragile: false,
            hazmat: false,
            requiresAgeVerification: false,
          },
        },
      }
    );
    await require('../../models/Size').collection.updateOne(
      { _id: line.size },
      {
        $set: {
          shippingWeight: 1000,
          packaging: { type: 'plastic_bottle', material: 'plastic' },
        },
      }
    );
  }
  await require('../../services/merchantFulfillment/actions').act(
    child._id,
    {
      action: 'accept',
      expectedVersion: 1,
      idempotencyKey: 'dispatch-accept',
    },
    actor
  );
  const service = require('../../services/deliveryProviders/localDispatch');
  await service.reviewContract(
    {
      tenant: String(child.tenant),
      location: String(child.location),
      version: 1,
      currency: 'NGN',
      amountMinor: 0,
      maxUnits: 5,
      maxWeightGrams: 5000,
      vehicleTypes: ['bike'],
      coverage: [
        {
          country: 'Nigeria',
          state: 'FCT',
          city: 'Abuja',
          minLat: 9,
          maxLat: 9.1,
          minLon: 7.3,
          maxLon: 7.5,
        },
      ],
      capabilities: {
        alcohol: false,
        ageVerification: false,
        fragile: false,
      },
      reviewReference: 'synthetic-reviewed-free-local-leg',
      validUntil: new Date(Date.now() + 86400000).toISOString(),
    },
    f.admin
  );
  const driver = await Driver.create({
    tenant: child.tenant,
    name: 'Synthetic rider',
    phone: 'synthetic-quantity',
    vehicle: { type: 'bike', capacityKg: 10 },
  });
  const quote = await service.quoteDispatch(
    child._id,
    { lines: [{ line: String(child.lines[0].line), quantity: 1 }] },
    actor
  );
  const booking = await service.bookDispatch(
    child._id,
    {
      quoteId: String(quote._id),
      driverId: String(driver._id),
      idempotencyKey: 'quantity-trip',
    },
    actor
  );

  return {
    f,
    child,
    other,
    actor,
    driver,
    booking,
    service,
    Child,
    Order,
    Stock,
    Hold,
  };
}
module.exports = { fixture };
