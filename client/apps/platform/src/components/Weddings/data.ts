export const weddingDrinks = [
  { id: 'toast', label: 'Champagne & sparkling wine', moment: 'For the toast', text: 'Compare the exact label and bottle size for your celebration.', href: '/shop?category=champagne', link: 'Browse champagne', symbol: 'toast' },
  { id: 'wine', label: 'Wine with the meal', moment: 'Around the table', text: 'Start with your menu and the red, white or rosé your guests enjoy.', href: '/shop?category=wine', link: 'Browse wines', symbol: 'wine' },
  { id: 'beer', label: 'Beer', moment: 'Familiar favourites', text: 'Check bottle or can sizes, pack counts and the selected seller’s stock.', href: '/shop?category=beer', link: 'Browse beer', symbol: 'beer' },
  { id: 'spirits', label: 'Spirits', moment: 'For your bar list', text: 'Share preferred bottles and discuss mixers and serving with your caterer.', href: '/shop?category=whisky', link: 'Browse whisky', symbol: 'spirits' },
  { id: 'alcohol-free', label: 'Non-alcoholic drinks', moment: 'Include every guest', text: 'Plan water, soft drinks and non-alcoholic options alongside the rest.', href: '/shop?category=non-alcoholic', link: 'Browse non-alcoholic', symbol: 'water' },
] as const;

export type WeddingDrinkId = typeof weddingDrinks[number]['id'];
