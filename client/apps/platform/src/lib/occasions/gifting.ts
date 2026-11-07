// Picked from the occasion design: subpages are topic landing pages mounted
// under /occasions/gifting/[subpage]. Owned by the gifting agent — do not edit
// from other workstreams. See docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md.
import type { SubpageDoc } from './types';

export const giftingSubpages: SubpageDoc[] = [
  {
    slug: 'hampers',
    title: 'Gift Hampers & Champagne Gifts in Nigeria',
    heading: 'Gift hampers and champagne gifts in Nigeria',
    description:
      'Plan drink gift hampers in Nigeria. Choose wine, champagne and non-alcoholic bottles, confirm what the packaging includes, and check the recipient-side delivery details before you pay.',
    intro:
      'A hamper is a drinks order plus packaging plus a delivery arrangement — all three need confirming. Build it around the recipient’s taste, ask exactly what the packing includes, then check who receives it and when.',
    sections: [
      {
        heading: 'A hamper is a drinks order plus packaging',
        text:
          'A product image does not show a gift box, ribbon, hamper basket or wrapping — those must be confirmed explicitly with our team before you expect them. Ask what the packaging includes for the exact bottles, whether a message card can be added, and whether any hamper assembly is arranged separately. Nothing decorative is included by default.',
      },
      {
        heading: 'Choose bottles that suit one recipient each',
        text:
          'Decide how many hampers you need and the bottle list for each one, then confirm the exact sizes and current stock of every line. Gaps are not automatically filled with substitutes: agree any acceptable swaps in writing so the recipient never receives a bottle you did not choose. Non-alcoholic bottles work just as well if the recipient does not drink.',
      },
      {
        heading: 'Deliver it like a gift, not an order',
        text:
          'Confirm the recipient’s address, phone contact and when they will be available. Alcohol can only be received by an adult aged 18 or over. Share your celebration date so our team can advise on a realistic delivery window — a requested celebration date is not automatically a guaranteed arrival date, so build in time to spare.',
      },
    ],
    checklist: [
      'Recipient’s drink preferences and restrictions',
      'Bottle names, sizes and quantity per hamper',
      'Packaging, wrapping and message requirements confirmed in writing',
      'Delivery city, receiving contact and adult 18+ recipient',
    ],
    facts: ['Nothing decorative or wrapping-related is included by default', 'Substitutions apply only in writing — never an unchosen bottle', 'Non-alcoholic options are first-class hamper choices', 'Alcohol can only be received by an adult aged 18 or over'],
    shelves: [
      { href: '/shop?category=wine', label: 'Wine for hampers' },
      { href: '/shop?category=champagne', label: 'Champagne for hampers' },
      { href: '/shop?category=scotch', label: 'Whisky for hampers' },
      { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic hamper options' },
    ],
  },
  {
    slug: 'corporate-gifts',
    title: 'Corporate Drinks Gifts in Nigeria',
    heading: 'Corporate drinks gifts in Nigeria',
    description:
      'Plan corporate drinks gifts in Nigeria. Agree the bottle list and non-alcoholic options with your team, confirm packaging and invoicing, and check delivery to every recipient.',
    intro:
      'Client gifts, staff appreciation and year-end packages work when the list, the logistics and the company policy are settled first. Agree what you are buying and for whom, then confirm the packaging and delivery arrangements bottle by bottle.',
    sections: [
      {
        heading: 'Start from your company policy',
        text:
          'Settle the approved bottle types, quantities and how many recipients before choosing labels. If procurement needs an invoice or a specific payment route, share those requirements with our team before purchase. Confirm the workplace alcohol policy, and keep a non-alcoholic option in the list so every recipient is covered.',
      },
      {
        heading: 'The recipient list drives the bottles',
        text:
          'Some recipients may not drink alcohol for health or religious reasons, so a gift that assumes alcohol can misfire. A simple approach is one bottle for people who enjoy drinks and a curated non-alcoholic option for everyone else. If you are unsure about a recipient, an alcohol-free choice is the safer default.',
      },
      {
        heading: 'Confirm logistics before promising colleagues',
        text:
          'Multiple delivery addresses, branded packaging, cards and gift wrapping must all be confirmed with our team — they are not automatic. Alcohol gifts need an adult aged 18 or over at each delivery address. Confirm stock and the delivery window carefully: an enquiry does not reserve stock, and a date you want to celebrate is not by itself a guaranteed arrival date.',
      },
    ],
    checklist: [
      'Approved bottle list and quantity per recipient',
      'Non-alcoholic options for every recipient',
      'Packaging, branding, cards and invoice requirements',
      'Delivery addresses, contact numbers and adult 18+ recipients',
    ],
    facts: ['Company policy first: approved types, quantities, recipients', 'Keep a non-alcoholic option for every recipient', 'Branding, cards and multi-address delivery all need confirmation', 'Enquiries do not reserve stock or guarantee arrival dates'],
    shelves: [
      { href: '/shop?category=wine', label: 'Wine for corporate gifts' },
      { href: '/shop?category=champagne', label: 'Champagne for clients' },
      { href: '/shop?category=scotch', label: 'Whisky for corporate gifts' },
      { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic corporate options' },
    ],
  },
];
