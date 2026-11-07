// Deterministic planning config for the wedding page. Quantities only — no
// prices, sizes or pack choices appear in planning output; pricing stays on
// /shop and suggested bottles join the request list as name + quantity.
// Shares are independent: each row counts only the guests who will drink it.
import type { CalcConfig } from '@/lib/occasions/types';

export const weddingToastCalc: CalcConfig = {
  heading: 'Estimate your reception quantities',
  intro: 'Enter confirmed guests and how long the reception runs. Each row counts only the guests who will actually drink that category — shares are independent and do not need to add to 100. Alcoholic rows are for adults aged 18 and over.',
  rows: [
    { id: 'toast', label: 'Toast', category: 'Champagne', sharePercent: 100, drinksPerGuest: 1, drinksPerExtraHour: 0, servingsPerBottle: 5, listName: 'Toast champagne or sparkling wine', roundTo: 6 },
    { id: 'meal', label: 'Meal', category: 'Wine', sharePercent: 70, drinksPerGuest: 1, drinksPerExtraHour: 1, servingsPerBottle: 5, listName: 'Reception wine', roundTo: 6 },
    { id: 'beer', label: 'Bar', category: 'Beer', sharePercent: 40, drinksPerGuest: 1, drinksPerExtraHour: 1, servingsPerBottle: 1, listName: 'Reception beer (bottles or cans)', roundTo: 24 },
    { id: 'spirits', label: 'Spirits', category: 'Spirits', sharePercent: 30, drinksPerGuest: 1, drinksPerExtraHour: 1, servingsPerBottle: 20, listName: 'Reception spirits (whisky, gin or vodka)' },
    { id: 'water', label: 'Water', category: 'Water', sharePercent: 100, drinksPerGuest: 2, drinksPerExtraHour: 1, servingsPerBottle: 6, listName: 'Bottled water', roundTo: 12 },
    { id: 'soft', label: 'Soft drinks', category: 'Soft drinks', sharePercent: 85, drinksPerGuest: 2, drinksPerExtraHour: 1, servingsPerBottle: 2, listName: 'Soft drinks', roundTo: 12 },
  ],
};
