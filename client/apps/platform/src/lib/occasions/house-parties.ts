// Picked from the occasion design: subpages are topic landing pages mounted
// under /occasions/house-parties/[subpage]. Owned by the house-parties agent —
// do not edit from other workstreams. See docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md.
import type { SubpageDoc } from './types';

export const housePartiesSubpages: SubpageDoc[] = [
  {
    slug: 'cocktails',
    title: 'Cocktails for House Parties in Nigeria',
    heading: 'Cocktails and mixing drinks for a house party in Nigeria',
    description: 'Plan cocktails for a house party in Nigeria. Choose recipes first, work out the gin, vodka and mixer bottles behind them, then compare stock and delivery before ordering.',
    intro: 'A short cocktail menu of two or three recipes is easier to run than a full bar. Choose the recipes first, work out the spirits and mixers behind each one, then compare bottles and delivery before your gathering.',
    sections: [
      { heading: 'Choose the recipes before the bottles', text: 'Every cocktail locks in a spirit, one or two mixers and garnishes, so deciding the menu first keeps the shopping list small. Two or three recipes are usually enough for a house party; most guests still reach for beer and soft drinks between cocktails.' },
      { heading: 'Plan for ice, cups and garnish', text: 'A drinks order covers the bottles only. Ice, cups, glassware, garnishes and anyone to mix the cocktails are not included unless you arrange them with our team separately. Borrow what you can and buy the rest alongside the drinks.' },
      { heading: 'Check age rules and delivery timing', text: 'Alcohol is sold to adults aged 18 and over, so arrange an adult recipient for delivery. Confirm stock and delivery to your address before payment, and order before party day — same-day delivery depends on your location and order time and is never guaranteed.' },
    ],
    checklist: ['Two or three cocktail recipes you will actually serve', 'Guest count and how long the party runs', 'Ice, cups and garnish plan', 'Delivery address, date and adult recipient'],
    facts: ['Two or three recipes beat a full bar', 'Pick recipes first, then size the spirits', 'Ice, cups, garnish and a mixer are arranged separately', 'Alcohol: adults 18+ only; same-day delivery never guaranteed'],
    shelves: [
      { href: '/shop?category=gin', label: 'Gin for cocktails' },
      { href: '/shop?category=vodka', label: 'Vodka for mixing' },
      { href: '/shop?category=non-alcoholic', label: 'Mixers & soft drinks' },
      { href: '/shop?category=beer', label: 'Beer for the cooler' },
    ],
  },
  {
    slug: 'birthday',
    title: 'Birthday Drinks in Nigeria',
    heading: 'Drinks for a house birthday party in Nigeria',
    description: 'Plan drinks for a house birthday party in Nigeria. Estimate beer, wine, champagne and non-alcoholic bottles by guest count, then check stock and delivery before ordering.',
    intro: 'Match a birthday drinks list to the crowd, the cake table and how long the party runs. Estimate what you need, include real choices for guests who do not drink alcohol, and confirm delivery before the big day.',
    sections: [
      { heading: 'Match drinks to the crowd', text: 'House birthday parties mix ages and habits. Count beer for the adults, soft drinks, water and juice for everyone else, and a genuine option for guests who drive or do not drink alcohol. Guest numbers alone do not set the quantity; party length and preferences matter.' },
      { heading: 'Separate the toast from the evening', text: 'Set aside a small, dedicated set of bottles for the candle moment — champagne or sparkling works well — and let beer or wine carry the rest of the evening. Compare bottle sizes so the toast bottles match the glasses you plan to use.' },
      { heading: 'Order before the day', text: 'Send your bottle list and details with time to spare. An enquiry starts a conversation and does not reserve stock or book delivery, and your chosen date is not guaranteed for delivery. Confirm quantities, delivery timing and any substitutions before paying, arrange an adult recipient aged 18 or over, and plan ice and cups separately.' },
    ],
    checklist: ['Head count and party duration', 'Adults, children and non-drinkers on the guest list', 'Toast bottles plus everyday drinks', 'Delivery address, date and adult recipient'],
    facts: ['Count adults, children and non-drinkers separately', 'Keep a dedicated bottle set for the candle moment', 'Enquiries do not reserve stock or book delivery', 'Your chosen date is not a guaranteed delivery date'],
    shelves: [
      { href: '/shop?category=beer', label: 'Beer for the party' },
      { href: '/shop?category=wine', label: 'Wine for the evening' },
      { href: '/shop?category=champagne', label: 'Champagne for the toast' },
      { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic choices' },
    ],
  },
];
