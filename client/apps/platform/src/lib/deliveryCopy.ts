/** Published delivery terms for the DrinksHarbour marketplace. */
export const ELSEWHERE_DELIVERY_WINDOW = '1–2 days (within 48 hours)';
export const NATIONWIDE_DELIVERY_PROMISE = `Same-day delivery in Abuja. Delivery in ${ELSEWHERE_DELIVERY_WINDOW} elsewhere in Nigeria.`;
export const ABUJA_DELIVERY_ELIGIBILITY = 'Same-day delivery is available for eligible FCT addresses on orders placed before noon, subject to stock.';

export const DELIVERY_COPY = {
  coverage: 'We deliver to all 36 states and the Federal Capital Territory (FCT).',
  timing: `${NATIONWIDE_DELIVERY_PROMISE} ${ABUJA_DELIVERY_ELIGIBILITY}`,
  fct: '₦2,000,000+ in Abuja/FCT',
  elsewhere: '₦10,000,000+ elsewhere',
  compact: 'Abuja/FCT ₦2m+ · Other states ₦10m+',
  summary: 'Free delivery: ₦2,000,000+ in Abuja/FCT; ₦10,000,000+ elsewhere.',
  minimumOrder: 'There is no minimum order amount. Standard free delivery starts at ₦2,000,000 in Abuja/FCT and ₦10,000,000 in other states. Delivery fees depend on your destination and order; the final fee and any eligible offer are shown at checkout.',
} as const;
