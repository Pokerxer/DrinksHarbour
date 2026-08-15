// Shipping and return policy as structured data.
//
// Google drops an OfferShippingDetails node that carries no shippingRate, which
// is why the Rich Results Test reported "missing field shippingDetails" even
// though the node was being emitted — so a rate is mandatory here, not optional.
//
// Every value below is copied from what we publish to customers at
// /shipping-info and /returns. Structured data has to match the page a visitor
// reads; if either policy page changes, this file changes with it.

const CURRENCY = 'NGN';

// /shipping-info splits delivery into 7 zones by distance from the Abuja hub.
// Rather than average that into one misleading number, we emit two regions:
// the FCT same-day service and everything else. Ranges are the published
// min/max across the zones each entry covers.
export const SHIPPING_DETAILS = [
  {
    '@type': 'OfferShippingDetails',
    // Zone 1 — FCT local, same-day by dedicated rider.
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'NG',
      addressRegion: 'FCT',
    },
    shippingRate: {
      '@type': 'MonetaryAmount',
      currency: CURRENCY,
      minValue: 2500,
      maxValue: 10000,
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      businessDays: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      // Dispatch within 24h of payment; same-day delivery inside the FCT.
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      transitTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
    },
  },
  {
    '@type': 'OfferShippingDetails',
    // Zones 2-7 — the other 36 states, couriered from the Abuja warehouse.
    shippingDestination: {
      '@type': 'DefinedRegion',
      addressCountry: 'NG',
    },
    shippingRate: {
      '@type': 'MonetaryAmount',
      currency: CURRENCY,
      minValue: 10000,
      maxValue: 60000,
    },
    // Free nationwide delivery kicks in at ₦2,000,000.
    freeShippingThreshold: {
      '@type': 'DeliveryChargeSpecification',
      priceCurrency: CURRENCY,
      eligibleTransactionVolume: {
        '@type': 'PriceSpecification',
        priceCurrency: CURRENCY,
        minPrice: 2000000,
      },
    },
    deliveryTime: {
      '@type': 'ShippingDeliveryTime',
      businessDays: {
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
      },
      handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
      // Zone 2 next-day at the fastest, Zone 7 (remote/riverine) at 7 days.
      transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 7, unitCode: 'DAY' },
    },
  },
];

// /returns: 7-day window from delivery, we arrange and pay for pickup, refunds
// land 3-5 business days after the item passes inspection.
export const MERCHANT_RETURN_POLICY = {
  '@type': 'MerchantReturnPolicy',
  applicableCountry: 'NG',
  returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
  merchantReturnDays: 7,
  returnMethod: 'https://schema.org/ReturnByMail',
  // "No. For approved returns, we arrange and cover the cost of pickup."
  returnFees: 'https://schema.org/FreeReturn',
  refundType: [
    'https://schema.org/FullRefund',
    'https://schema.org/StoreCreditRefund',
  ],
  returnPolicyCountry: 'NG',
};
