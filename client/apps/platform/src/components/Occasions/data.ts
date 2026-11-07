import type { OccasionId } from '@/lib/occasionBrief';

export type OccasionCardData = {
  id: Exclude<OccasionId, 'bulk'>;
  label: string;
  eyebrow: string;
  description: string;
  shelves: { href: string; label: string }[];
};

export const occasionCards: OccasionCardData[] = [
  { id: 'weddings', label: 'Weddings', eyebrow: 'For the big day',
    description: 'From the first toast to the last dance. Start with your menu, your guests and a bottle list that feels like you.',
    shelves: [{ href: '/shop?category=wine', label: 'Wine' }, { href: '/shop?category=champagne', label: 'Champagne' }, { href: '/shop?category=non-alcoholic', label: 'Alcohol-free choices' }] },
  { id: 'corporate', label: 'Corporate events', eyebrow: 'Good business, good company',
    description: 'A team celebration, a client reception or a thoughtful thank-you. Put the brief and budget in one place.',
    shelves: [{ href: '/shop?category=wine', label: 'Reception wines' }, { href: '/shop?category=whisky', label: 'Whisky' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic drinks' }] },
  { id: 'house-parties', label: 'House parties', eyebrow: 'Your place, your people',
    description: 'Dinner with friends or a full house. Pick familiar favourites, a few mixers and something for everyone.',
    shelves: [{ href: '/shop?category=beer', label: 'Beer' }, { href: '/shop?category=gin', label: 'Gin' }, { href: '/shop?category=non-alcoholic', label: 'Non-alcoholic drinks' }] },
  { id: 'gifting', label: 'Gifting', eyebrow: 'A little thought goes a long way',
    description: 'Find a bottle they will enjoy. Start with their taste, then ask about the packaging and delivery details.',
    shelves: [{ href: '/shop?category=wine', label: 'Wine gifts' }, { href: '/shop?category=scotch', label: 'Scotch whisky' }, { href: '/shop?category=champagne', label: 'Champagne' }] },
];
