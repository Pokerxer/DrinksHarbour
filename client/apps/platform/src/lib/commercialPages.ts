export type EnquiryType = 'bulk' | 'weddings' | 'corporate' | 'house-parties' | 'gifting';
export type GuideLink = { href: string; label: string };
export type CommercialPage = {
  slug: EnquiryType;
  path: string;
  label: string;
  title: string;
  heading: string;
  description: string;
  intro: string;
  sections: { heading: string; text: string }[];
  checklist: string[];
  shelves: GuideLink[];
  /** Honest quick facts for the chip strip; subpages populate it. */
  facts?: string[];
};

export const bulkPage: CommercialPage = {
  slug: 'bulk', path: '/bulk-drinks', label: 'Bulk & case buying',
  title: 'Buy Bulk Drinks & Cases in Nigeria',
  heading: 'Bulk drinks for your next order in Nigeria',
  description: 'Plan bulk drinks orders in Nigeria. Compare bottle and case quantities, check seller pricing and stock, and enquire about wine, spirits and event delivery.',
  intro: 'Buying for a wedding, office or gathering? Compare current bottle prices and available pack options, then check stock, quantities and delivery before committing to a bulk order.',
  sections: [
    { heading: 'Read the pack before the price', text: 'A case can contain different numbers of bottles. Match the drink, bottle size and pack count, then compare the total order cost. Where a product offers quantity pricing, its purchase panel shows the available tiers. A bulk enquiry does not guarantee a discount.' },
    { heading: 'Plan across sellers', text: 'Different sellers can carry the same bottle at different prices and quantities. Check each selected offer and any minimum or maximum quantity. Orders involving more than one seller may have different fulfilment arrangements; confirm the full delivery plan.' },
    { heading: 'Set a delivery deadline', text: 'For events, share your date and delivery address before ordering. Ask about stock and carton handling, and leave time for receiving and checking the order. Your enquiry is not a stock reservation or a confirmed delivery booking.' },
  ],
  checklist: ['Bottle names, sizes and quantities', 'Budget for drinks and delivery', 'Delivery city and required date', 'Any acceptable substitutions'],
  shelves: [{ href: '/shop?category=wine', label: 'Wine for bulk orders' }, { href: '/shop?category=beer', label: 'Beer & pack options' }, { href: '/shop?category=whisky', label: 'Whisky bottles' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic choices' }],
};

export const occasionPages: CommercialPage[] = [
  {
    slug: 'weddings', path: '/occasions/weddings', label: 'Weddings',
    title: 'Wedding Drinks & Bulk Wine in Nigeria',
    heading: 'Wedding drinks and bulk wine in Nigeria',
    description: 'Plan wedding drinks in Nigeria. Choose wine, champagne and non-alcoholic options, compare bottle quantities, and enquire about stock and event delivery.',
    intro: 'Build a wedding drinks list around your guests, menu and budget. Explore wine, champagne and non-alcoholic options, then confirm the bottles, quantities and delivery arrangements for your venue.',
    sections: [
      { heading: 'Separate the toast from the meal', text: 'A toast and a full reception need different drinks plans. Choose sparkling wine or champagne for the toast, then match red, white or rosé wine to your menu and guest preferences. Compare the exact labels and bottle sizes.' },
      { heading: 'Include every guest', text: 'Set aside a separate budget for water, soft drinks and non-alcoholic choices. Agree serving arrangements with your venue or caterer. Guest numbers alone do not determine how much alcohol to buy; duration, preferences and the service format matter.' },
      { heading: 'Confirm before paying', text: 'Share your venue, event date and bottle list with support for a stock and delivery enquiry. Confirm quantities, delivery timing, packaging and any substitutions before placing the order. Catering, chilling and glassware are not included unless separately agreed.' },
    ],
    checklist: ['Event date, venue and guest count', 'Toast and meal drinks list', 'Alcoholic and non-alcoholic preferences', 'Budget, bottle sizes and receiving contact'],
    shelves: [{ href: '/shop?category=wine', label: 'Compare wedding wines' }, { href: '/shop?category=champagne', label: 'Champagne for the toast' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic options' }, { href: '/bulk-drinks', label: 'How bulk buying works' }],
  },
  {
    slug: 'corporate', path: '/occasions/corporate', label: 'Corporate events',
    title: 'Corporate Event Drinks & Gifts in Nigeria',
    heading: 'Drinks for corporate events in Nigeria',
    description: 'Plan corporate drinks orders in Nigeria. Compare wine, spirits and non-alcoholic choices for office events and client gifts; enquire about stock and delivery.',
    intro: 'Choose drinks for a client reception, team gathering or business gift. Start with your company’s preferences and budget, then compare available bottles and ask about your delivery requirements.',
    sections: [
      { heading: 'Write a purchasing brief', text: 'Agree the budget, approved drink types, quantities and delivery deadline with your team. Include non-alcoholic choices and confirm the workplace or venue’s alcohol policy before selecting bottles.' },
      { heading: 'Distinguish events from gifts', text: 'An event order needs a receiving and serving plan. Gifts need recipient preferences and a clear delivery address. Packaging, personal messages, branding and multiple-address delivery must be confirmed with support; they are not automatically included.' },
      { heading: 'Check the order details', text: 'Share any invoice or procurement requirements before purchase. Confirm the selected sellers, stock, quantities and delivery fees. An enquiry starts a conversation and does not create a credit account or confirm special payment terms.' },
    ],
    checklist: ['Event or gifting purpose', 'Approved budget and bottle quantities', 'Delivery address and deadline', 'Invoice and packaging requirements'],
    shelves: [{ href: '/shop?category=wine', label: 'Wine for receptions' }, { href: '/shop?category=whisky', label: 'Whisky for gifts' }, { href: '/shop?category=non-alcoholic', label: 'Alcohol-free choices' }, { href: '/occasions/gifting', label: 'Plan individual gifts' }],
  },
  {
    slug: 'house-parties', path: '/occasions/house-parties', label: 'House parties',
    title: 'House Party Drinks in Nigeria',
    heading: 'Plan your house party drinks in Nigeria',
    description: 'Shop drinks for house parties in Nigeria. Plan beer, wine, cocktail bottles and non-alcoholic choices, compare seller prices, and check delivery before ordering.',
    intro: 'Make a drinks list that fits your gathering, from a few bottles for dinner to a larger party order. Compare sizes and seller prices, include non-alcoholic choices, and check delivery before your guests arrive.',
    sections: [
      { heading: 'Choose a simple serving plan', text: 'A small wine and beer selection is easier to organise than a large cocktail menu. If you are mixing drinks, choose the recipes first so you can budget for the required spirits and mixers without buying unrelated bottles.' },
      { heading: 'Check what the order includes', text: 'Product prices cover the selected drinks and quantities. Ice, cups, chilling, bartending and equipment are not included unless specifically agreed. Plan those separately and follow each bottle’s storage guidance.' },
      { heading: 'Order with time to receive it', text: 'Confirm stock and your address’s delivery options before payment. Same-day options depend on location and order timing. Alcohol is for adults aged 18 and over; arrange an adult recipient and encourage responsible consumption.' },
    ],
    checklist: ['Guest preferences and drink choices', 'Bottle sizes, quantities and mixers', 'Delivery address and gathering time', 'Separate plan for ice and serving'],
    shelves: [{ href: '/shop?category=beer', label: 'Compare beers' }, { href: '/shop?category=gin', label: 'Gin for mixing' }, { href: '/shop?category=wine', label: 'Wine for dinner' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic drinks' }],
  },
  {
    slug: 'gifting', path: '/occasions/gifting', label: 'Gifting',
    title: 'Wine & Spirits Gifts in Nigeria',
    heading: 'Choose a drinks gift in Nigeria',
    description: 'Choose wine, champagne or whisky gifts in Nigeria. Compare available bottles, confirm packaging and recipient details, and check delivery before payment.',
    intro: 'Choose a bottle around the recipient’s taste, occasion and budget. Compare wine, champagne and whisky, then confirm the packaging and delivery details before placing your gift order.',
    sections: [
      { heading: 'Match the recipient’s preferences', text: 'Start with the styles they enjoy. Check the bottle’s origin, tasting notes and ABV where supplied. If you are unsure about alcohol preferences, consider a non-alcoholic option rather than assuming a spirit is appropriate.' },
      { heading: 'Check packaging explicitly', text: 'A bottle image does not guarantee a gift box, hamper or wrapping. Ask support what packaging is included with the exact offer and whether a message can be added. Personalisation and special presentation depend on confirmation.' },
      { heading: 'Plan the handover', text: 'Confirm the recipient’s address, contact details and availability. Alcoholic gifts require an adult recipient aged 18 or over. Allow for the destination’s delivery window; a requested celebration date is not automatically a guaranteed arrival date.' },
    ],
    checklist: ['Recipient’s drink preferences', 'Bottle choice and gift budget', 'Packaging or message requirements', 'Delivery city, date and adult recipient'],
    shelves: [{ href: '/shop?category=wine', label: 'Wine gift choices' }, { href: '/shop?category=champagne', label: 'Champagne gifts' }, { href: '/shop?category=scotch', label: 'Scotch whisky gifts' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic gifts' }],
  },
];

export function getOccasionPage(slug: string): CommercialPage | undefined {
  return occasionPages.find(page => page.slug === slug);
}
