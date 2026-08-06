// Delivery + payment options for the DrinksHarbour storefront checkout.
//
// Values are the canonical server payment methods (utils/paymentMethods.js):
// card / bank_transfer / cash_on_delivery — the old PayPal/Stripe/Mastercard
// demo options map to nothing the API accepts and would 400 on submit.
// `icon` names render via react-icons in the checkout components.

// shipping method data
export const shippingMethodData = [
  {
    id: 1,
    name: 'Standard',
    value: 'standard',
    icon: 'truck',
    image: '',
  },
  {
    id: 2,
    name: 'Express',
    value: 'express',
    icon: 'lightning',
    image: '',
  },
  {
    id: 3,
    name: 'Same-Day',
    value: 'same_day',
    icon: 'clock',
    image: '',
  },
];

// shipping duration data — NGN pricing
export const shippingSpeedData = [
  {
    id: 1,
    speed: 'slow',
    title: '₦1,500 Standard Delivery',
    description: 'Arrives within 4-6 business days from order date.',
    checked: true,
  },
  {
    id: 2,
    speed: 'default',
    title: '₦2,500 Express Delivery',
    description: 'Arrives within 2-3 business days from order date.',
    checked: false,
  },
  {
    id: 3,
    speed: 'quick',
    title: '₦4,000 Same-Day Delivery (Abuja)',
    description: 'Arrives today for orders placed before 2pm.',
    checked: false,
  },
];

// payment method data — canonical server values, paystack-ready
export const paymentMethodData = [
  {
    id: 1,
    name: 'Card Payment',
    value: 'card',
    icon: 'credit-card',
    image: '',
    description:
      'Pay securely with your debit or credit card. You will be redirected to Paystack to complete payment.',
    defaultChecked: false,
  },
  {
    id: 2,
    name: 'Bank Transfer',
    value: 'bank_transfer',
    icon: 'bank',
    image: '',
    description:
      'Transfer directly from your bank account. Your order is confirmed once payment is received.',
    defaultChecked: false,
  },
  {
    id: 3,
    name: 'Cash on Delivery',
    value: 'cash_on_delivery',
    icon: 'cash',
    image: '',
    description:
      'Pay in cash when your order is delivered. Available for eligible locations.',
    defaultChecked: true,
  },
];
