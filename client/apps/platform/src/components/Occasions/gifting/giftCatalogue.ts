import { loadOccasionOffers } from '../planning/occasionOffers';

export const giftCollections = [
  { category: 'champagne', name: 'Champagne & sparkling gifts', href: '/shop?category=champagne', detail: 'For birthdays, anniversaries and good news.' },
  { category: 'whisky', name: 'Whisky & Scotch gifts', href: '/shop?category=whisky', detail: 'For a thank-you, a milestone or a host.' },
  { category: 'non-alcoholic', name: 'Non-alcoholic drink gifts', href: '/shop?category=non-alcoholic', detail: 'For a toast everyone can join. Check each label for ABV.' },
  { category: 'wine', name: 'Wine gifts', href: '/shop?category=wine', detail: 'For dinner invitations and recipients who love wine.' },
];

export function loadGiftOffers() {
  return loadOccasionOffers(giftCollections.slice(0, 3).map(({ category }) => category));
}
