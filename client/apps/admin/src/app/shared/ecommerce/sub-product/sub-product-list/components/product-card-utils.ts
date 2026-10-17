import {
  PiWineBold,
  PiBeerBottleBold,
  PiDropBold,
  PiPackageBold,
} from 'react-icons/pi';
export const currencySymbols: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  ZAR: 'R',
  KES: 'KSh',
  GHS: '₵',
};

const TYPE_COLORS: Record<string, string> = {
  whisky: 'from-amber-50 to-amber-100/60',
  whiskey: 'from-amber-50 to-amber-100/60',
  bourbon: 'from-orange-50 to-orange-100/60',
  scotch: 'from-yellow-50 to-yellow-100/60',
  rum: 'from-rose-50 to-rose-100/60',
  gin: 'from-sky-50 to-sky-100/60',
  vodka: 'from-slate-50 to-slate-100/60',
  tequila: 'from-lime-50 to-lime-100/60',
  wine: 'from-purple-50 to-purple-100/60',
  champagne: 'from-yellow-50 to-yellow-100/50',
  beer: 'from-amber-50 to-yellow-50',
  brandy: 'from-orange-50 to-amber-100/60',
  cognac: 'from-amber-50 to-orange-100/60',
};

export const getBgGradient = (type?: string) => {
  if (!type) return 'from-gray-50 to-gray-100/60';
  const t = type.toLowerCase();
  for (const [key, val] of Object.entries(TYPE_COLORS)) {
    if (t.includes(key)) return val;
  }
  return 'from-gray-50 to-gray-100/60';
};

export const getBeverageIcon = (type?: string) => {
  if (!type) return PiPackageBold;
  const t = type.toLowerCase();
  if (t.includes('wine') || t.includes('champagne')) return PiWineBold;
  if (
    t.includes('beer') ||
    t.includes('lager') ||
    t.includes('ale') ||
    t.includes('stout')
  )
    return PiBeerBottleBold;
  if (t.includes('water') || t.includes('juice') || t.includes('soft'))
    return PiDropBold;
  return PiPackageBold;
};

export const stockBadge = (stock: number, threshold = 10) => {
  if (stock === 0)
    return {
      label: 'Out of stock',
      dot: 'bg-red-500',
      text: 'text-red-600 bg-red-50',
    };
  if (stock <= threshold)
    return {
      label: `Low · ${stock}`,
      dot: 'bg-amber-500',
      text: 'text-amber-700 bg-amber-50',
    };
  return {
    label: `${stock} in stock`,
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 bg-emerald-50',
  };
};
