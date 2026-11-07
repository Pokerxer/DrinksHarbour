// Picked from the occasion design: subpages are topic landing pages mounted
// under /occasions/weddings/[subpage]. Owned by the weddings agent — do not
// edit from other workstreams. See docs/superpowers/specs/2026-10-27-occasion-pages-subpages-design.md.
import type { SubpageDoc } from './types';

export const weddingsSubpages: SubpageDoc[] = [
  {
    slug: 'champagne',
    title: 'Champagne & sparkling for wedding toasts in Nigeria',
    heading: 'Champagne and sparkling wine for your wedding toast in Nigeria',
    description: 'Choose champagne or sparkling wine for a wedding toast in Nigeria. Work out how many bottles your toast needs, compare labels, and enquire about stock and venue delivery.',
    intro: 'The toast is one of the few drinks moments where every guest drinks at once, so it is planned on its own. Estimate bottles for one glass each, compare the exact labels you like, then send your toast list to our team to confirm stock and delivery.',
    sections: [
      { heading: 'Plan one glass for every guest', text: 'A toast is served to all guests at the same moment, so count your full guest list, including the children and non-drinkers you will cover with a non-alcoholic toast. One 750ml bottle gives roughly five to six toast pours; get sizes in writing because splits and magnums change the maths. Our estimate is a planning figure, not a promise of what is in stock.' },
      { heading: 'Sparkling is a style, not always champagne', text: 'Champagne, prosecco and other sparkling wines pour differently and cost differently. Compare the labels on each bottle page — origin, ABV and size where supplied — before you shortlist. Alcoholic bottles are for adults aged 18 and over, so arrange an adult toast line-up and serving crew.' },
      { heading: 'Confirm stock before you commit', text: 'Sending a toast list to our team starts a review; it does not reserve bottles or hold a price. Share your wedding date and venue so the team can check availability and delivery options, and confirm the final quantities, sizes and delivery arrangements before you pay any seller.' },
    ],
    checklist: ['Confirmed guest count for the toast', 'Preferred labels, bottle sizes and quantities', 'Non-alcoholic option for the same toast', 'Wedding date, venue and receiving contact'],
    facts: ['Count every guest — one glass each', 'One 750ml bottle ≈ 5–6 toast pours (confirm sizes in writing)', 'Enquiries do not reserve stock or hold prices', 'Non-alcoholic toast options welcome'],
    shelves: [
      { href: '/shop?category=champagne', label: 'Compare champagne bottles' },
      { href: '/shop?category=wine', label: 'Sparkling & still wines' },
      { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic toasts' },
      { href: '/bulk-drinks', label: 'How bulk buying works' },
    ],
  },
  {
    slug: 'traditional-engagement',
    title: 'Traditional engagement drinks in Nigeria',
    heading: 'Drinks for a traditional engagement in Nigeria',
    description: 'Plan drinks for a traditional engagement in Nigeria. Sort the family list from the guest drinks, compare available bottles, and enquire about stock and delivery to your venue.',
    intro: 'A traditional engagement usually carries two drinks lists: the items requested by the families for presentation, and the drinks served to everyone who attends. Keep the two apart, share the family list exactly as it was given, and let our team check what is available.',
    sections: [
      { heading: 'Keep the family list separate', text: 'Presentation items are often specified by name, size and quantity. Reproduce the list exactly as given — brand spellings, bottle sizes and counts — rather than substituting what looks similar. If the families allow alternatives, write down acceptable swaps before you enquire so nothing is settled on the day.' },
      { heading: 'Plan the floor drinks for everyone', text: 'Guests who are not part of the presentation still want water, soft drinks and familiar bottles through the day. Estimate floor drinks from your confirmed attendance, include non-alcoholic choices for every table, and agree the serving plan with your MC or caterer. Alcoholic bottles are served to adults aged 18 and over only.' },
      { heading: 'Enquire early, confirm before paying', text: 'Share the combined list, your engagement date, the city and the venue with support. The team reviews stock and delivery options and replies with what is available; an enquiry does not reserve stock or guarantee a delivery date. Confirm final quantities, packaging and receiving arrangements before any payment.' },
    ],
    checklist: ['Family presentation list, exactly as given', 'Floor-drinks quantities for confirmed attendance', 'Non-alcoholic choices for all guests', 'Engagement date, city, venue and receiving contact'],
    facts: ['Keep the family list separate from guest drinks', 'Reproduce names, sizes and counts exactly', 'Alcohol served to adults 18+ only', 'Enquiries do not reserve stock or guarantee dates'],
    shelves: [
      { href: '/shop?category=wine', label: 'Wine for engagements' },
      { href: '/shop?category=champagne', label: 'Champagne & sparkling' },
      { href: '/shop?category=whisky', label: 'Whisky for presentations' },
      { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic choices' },
    ],
  },
];
