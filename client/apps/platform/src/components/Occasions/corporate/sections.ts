// Richer corporate section story shown between the CommercialGuide hero and the
// staff request form. Honest copy throughout: enquiries do not reserve stock,
// create credit accounts or guarantee dates. No price language here — pricing
// stays on /shop and in the team's reply. Optional `links` carry descriptive
// in-copy anchors to this occasion's own subpages.
export type PlanningSection = { heading: string; text: string; links?: { href: string; label: string }[] };

export const planningSections: PlanningSection[] = [
  {
    heading: 'Start from a purchasing brief',
    text: 'Agree the budget, approved drink types, quantities, delivery city and required date inside your team before touching a catalogue. Include non-alcoholic choices for every guest and confirm the workplace or venue alcohol policy. Note what the order does not cover — ice, chilling, glassware, cups and bartending are arranged separately with your venue or caterer.',
  },
  {
    heading: 'Order events and gifts differently',
    text: 'An end-of-year reception is sized by attendance and hours, so estimate it with the tool below and adjust the lines. Client gifts are the opposite: count bottles individually, match each one to a recipient, and confirm packaging, messages and every delivery address with the team. Mixing the two in one bulk list is how gift budgets get overspent.',
    links: [
      { href: '/occasions/corporate/end-of-year-events', label: 'end-of-year events guide' },
      { href: '/occasions/corporate/client-gifts', label: 'client gifts guide' },
    ],
  },
  {
    heading: 'Procurement and invoice care',
    text: 'Share invoice, purchase-order or approval requirements with support before purchase so the order can be documented correctly. An enquiry starts a conversation: it does not reserve stock, create a credit account or guarantee payment terms. Quantities are confirmed against current availability, and delivery windows are agreed with support — they are not guaranteed dates.',
  },
];
