'use strict';
// Synthetic external HTTP boundary only. All quote/review/booking/stock logic stays real.
module.exports = function install(app, { f, child, actor }) {
  const native = global.fetch;
  let posts = 0, prepared = false, sender, receiver;
  global.fetch = async (url, options = {}) => {
    if (!String(url).startsWith('https://api.shipbubble.com/v1/')) return native(url, options);
    const path = new URL(url).pathname;
    const body = options.body ? JSON.parse(options.body) : {};
    const response = data => new Response(JSON.stringify({ status: 'success', data }));
    if (path === '/v1/shipping/address/validate') {
      const origin = body.email === 'sender@example.test';
      if (origin) sender = body.address; else receiver = body.address;
      return response({ address_code: origin ? 1 : 2, formatted_address: body.address, country_code: 'NG' });
    }
    if (path === '/v1/shipping/fetch_rates') return response({ request_token: 'synthetic-browser-rate', couriers: [
      { courier_id: 'parcel', service_code: 'regular', courier_name: 'Synthetic parcel', service_type: 'pickup', currency: 'NGN', total: 0, rate_card_amount: 0 },
    ] });
    if (path === '/v1/shipping/labels') {
      posts++;
      return response({ order_id: 'SB-BROWSER', status: 'pending', ship_from: { address: sender }, ship_to: { address: receiver },
        payment: { currency: 'NGN', type: 'wallet', status: 'completed', shipping_fee: 0 } });
    }
    if (path === '/v1/shipping/labels/list/SB-BROWSER') return response({ results: [{ order_id: 'SB-BROWSER', status: 'completed' }] });
    throw new Error('Unlisted synthetic carrier request');
  };
  app.post('/__test/prepare-carrier', async (req, res, next) => {
    try {
      if (prepared) throw new Error('Carrier browser setup already consumed');
      const Child = require('../../models/MerchantOrder');
      const current = await Child.findById(child._id).lean();
      await require('../../models/Warehouse').collection.updateOne({ _id: child.location }, { $set: {
        address: { line1: 'Synthetic origin', city: 'Abuja', state: 'FCT', country: 'Nigeria' },
        contact: { name: 'Synthetic sender', email: 'sender@example.test', phone: '+2348000000001' },
      } });
      await require('../../models/Order').collection.updateOne({ _id: child.order }, { $set: { 'shippingAddress.phone': '+2348000000000' } });
      const allocation = await require('../../services/merchantFulfillment/quantity/commands').shipQuantities(child._id,
        { lines: [{ line: String(child.lines[0].line), quantity: 1 }], expectedVersion: current.version, idempotencyKey: 'browser-carrier-original-goods' }, actor);
      await require('../../services/deliveryProviders/external').reviewCarrier({ tenant: String(child.tenant), location: String(child.location), version: 1,
        account: 'BROWSER', categoryId: 1, allowedServices: [{ courierId: 'parcel', serviceCode: 'regular' }],
        capabilities: { alcohol: false, ageVerification: false, fragile: false }, maxUnits: 5, maxWeightGrams: 5000,
        reviewReference: 'Synthetic browser free parcel only; not provider approval', validUntil: new Date(Date.now() + 86400000) }, f.admin);
      process.env.SHIPBUBBLE_ACCOUNT_BROWSER = 'sb_sandbox_synthetic_browser';
      process.env.MERCHANT_EXTERNAL_CARRIER_ENABLED = 'true'; prepared = true;
      res.json({ allocation: allocation._id });
    } catch (error) { next(error); }
  });
  return { restore: () => { global.fetch = native; }, summary: async () => ({
    carrierBookings: await require('../../models/MerchantCarrierBooking').countDocuments({ merchantOrder: child._id }), providerPosts: posts,
  }) };
};
