// Picked from the occasion design: subpages are topic landing pages mounted
// under /occasions/corporate/[subpage]. Owned by the corporate agent — do not
// edit from other workstreams. See docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md.
import type { SubpageDoc } from './types';

export const corporateSubpages: SubpageDoc[] = [
  {
    slug: 'client-gifts',
    title: 'Client Gifts: Wine & Whisky in Nigeria',
    heading: 'Drinks gifts for clients in Nigeria',
    description: 'Choose wine, champagne and whisky gifts for Nigerian clients and partners. Compare available bottles, confirm packaging and addresses, and send your procurement enquiry.',
    intro: 'Build a client gift list around each recipient and your procurement process. Compare the bottles currently available, note the packaging you need, then send your bottle names, quantities and delivery details to the team to confirm.',
    sections: [
      { heading: 'Match bottles to recipients', text: 'Start with the drink styles each recipient actually enjoys. Where you are unsure, include a non-alcoholic option rather than assuming a spirit is welcome. Alcoholic gifts require an adult recipient aged 18 or over, and a short list of quality bottles usually lands better than a large mixed order.' },
      { heading: 'Confirm packaging and every address', text: 'A bottle photograph does not guarantee a gift box, hamper or card. Ask the team what packaging is included with the exact offer and whether a message can be added. If bottles are going to several offices or homes, each delivery address and its window is confirmed individually — a requested date is not automatically a guaranteed arrival date.' },
      { heading: 'Fold gifts into your procurement flow', text: 'Share invoice, purchase-order or admin approval requirements before purchase so support can document the order correctly. An enquiry starts a conversation: it does not create a credit account, guarantee payment terms, or reserve stock. Quantities are confirmed against current availability before you pay.' },
    ],
    checklist: ['Recipient list and drink preferences', 'Approved bottles and per-recipient quantities', 'Packaging, message and delivery addresses', 'Invoice or approval requirements and delivery deadline'],
    facts: ['Short quality lists usually land better than large mixed ones', 'Gift boxes, hampers and cards need written confirmation', 'Every address and window is confirmed individually', 'Enquiries do not create credit accounts or reserve stock'],
    shelves: [
      { href: '/shop?category=whisky', label: 'Whisky for client gifts' },
      { href: '/shop?category=wine', label: 'Wine gift bottles' },
      { href: '/shop?category=champagne', label: 'Champagne for key clients' },
      { href: '/occasions/gifting', label: 'Plan individual gifts' },
    ],
  },
  {
    slug: 'end-of-year-events',
    title: 'End-of-Year Party Drinks in Nigeria',
    heading: 'Drinks for end-of-year events in Nigeria',
    description: 'Plan drinks for company end-of-year parties in Nigeria. Size sparkling, wine, beer and non-alcoholic quantities against attendance and hours, then confirm stock and delivery with the team.',
    intro: 'An end-of-year event blends a welcome toast, a long reception and colleagues who prefer not to drink alcohol. Work through your quantities with the planning tools, then confirm the exact bottles, packaging and delivery for your venue before paying.',
    sections: [
      { heading: 'Size the reception honestly', text: 'Plan from expected attendance and event duration, not from a single bottle-per-guest rule. Split the plan across the welcome toast, table wine or beer for the reception, and water and soft drinks for every guest. The calculator suggests quantities you can adjust; it is an estimate, not an order.' },
      { heading: 'Agree the serving arrangements', text: 'Bottle orders cover the drinks. Ice, chilling, glassware, cups and bartending are arranged with your venue or caterer separately — confirm those arrangements and any storage space at the venue before delivery day.' },
      { heading: 'Confirm before you commit', text: 'Send your bottle list, quantities, delivery city and required date to the team. An enquiry does not reserve stock and does not create a credit account; quantities are confirmed against current availability. Delivery windows are agreed with support and are not guaranteed dates. Alcoholic orders are for adults aged 18 or over.' },
    ],
    checklist: ['Event date, venue and expected attendance', 'Toast, reception and non-alcoholic quantities', 'Serving arrangements for ice and glassware', 'Invoice requirements and delivery deadline'],
    facts: ['Size from attendance and duration — not one bottle-per-guest rule', 'Ice, glassware and bartending arranged separately', 'Enquiries do not reserve stock or create credit accounts', 'Delivery windows agreed with support, never guaranteed dates'],
    shelves: [
      { href: '/shop?category=wine', label: 'Wine for company parties' },
      { href: '/shop?category=beer', label: 'Beer and lager cases' },
      { href: '/shop?category=champagne', label: 'Sparkling for the toast' },
      { href: '/shop?category=non-alcoholic', label: 'Alcohol-free choices' },
    ],
  },
];
