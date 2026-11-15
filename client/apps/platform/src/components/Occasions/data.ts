import type { OccasionId } from '@/lib/occasionBrief';

export type OccasionCardData = {
  id: Exclude<OccasionId, 'bulk'>;
  label: string;
  action: string;
  image?: string;
  description: string;
  shelves: { href: string; label: string }[];
};

export const occasionCards: OccasionCardData[] = [
  { id: 'weddings', label: 'Weddings', action: 'Shop wedding drinks', image: '/images/wedding-drinks-abuja.webp',
    description: 'Shop for the toast, reception or traditional engagement. Get help with quantities and venue delivery.',
    shelves: [{ href: '/shop?category=wine', label: 'Wine' }, { href: '/shop?category=champagne', label: 'Champagne' }, { href: '/shop?category=non-alcoholic', label: 'Alcohol-free choices' }] },
  { id: 'corporate', label: 'Corporate events', action: 'Explore corporate drinks',
    description: 'A team celebration, a client reception or a thoughtful thank-you. Put the brief and budget in one place.',
    shelves: [{ href: '/shop?category=wine', label: 'Reception wines' }, { href: '/shop?category=whisky', label: 'Whisky' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic drinks' }] },
  { id: 'house-parties', label: 'House parties', action: 'Shop party drinks', image: '/images/party-drinks-abuja.webp',
    description: 'Find beer, wine, cocktail spirits and mixers for birthdays, dinners and house parties.',
    shelves: [{ href: '/shop?category=beer', label: 'Beer' }, { href: '/shop?category=gin', label: 'Gin' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic drinks' }] },
  { id: 'gifting', label: 'Gifting', action: 'Shop drinks gifts', image: '/images/drinks-gifting-abuja.webp',
    description: 'Choose a drink, add a personal message and check gift packaging and delivery options.',
    shelves: [{ href: '/shop?category=wine', label: 'Wine gifts' }, { href: '/shop?category=scotch', label: 'Scotch whisky' }, { href: '/shop?category=champagne', label: 'Champagne' }] },
];
