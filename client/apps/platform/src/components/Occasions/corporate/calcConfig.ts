// Corporate event serving plan. Deterministic quantities only — no prices, no AI.
// Shares are independent (water serves every guest while wine serves some);
// they are not percentages that must sum to 100.
import type { CalcConfig } from '@/lib/occasions/types';

export const corporateEventCalc: CalcConfig = {
  heading: 'End-of-year reception quantities',
  intro: 'Enter expected attendance and planned hours to size a reception order. The categories overlap on purpose — many guests will have water and soft drinks without taking wine or beer. These are planning estimates to discuss with our team; they are not an order.',
  rows: [
    {
      id: 'toast-sparkling',
      label: 'Welcome toast',
      category: 'Sparkling wine',
      sharePercent: 50,
      drinksPerGuest: 1,
      drinksPerExtraHour: 0,
      servingsPerBottle: 6,
      listName: 'Sparkling wine for the welcome toast',
      roundTo: 6,
    },
    {
      id: 'reception-beer',
      label: 'Reception bar',
      category: 'Beer & lager',
      sharePercent: 60,
      drinksPerGuest: 2,
      drinksPerExtraHour: 1,
      servingsPerBottle: 1,
      listName: 'Beer and lager for the reception',
      roundTo: 24,
    },
    {
      id: 'reception-wine',
      label: 'Reception bar',
      category: 'Table wine',
      sharePercent: 40,
      drinksPerGuest: 1,
      drinksPerExtraHour: 1,
      servingsPerBottle: 5,
      listName: 'Red or white wine for the reception',
    },
    {
      id: 'mixing-spirits',
      label: 'Long drinks',
      category: 'Spirits for mixing',
      sharePercent: 30,
      drinksPerGuest: 1,
      drinksPerExtraHour: 1,
      servingsPerBottle: 20,
      listName: 'Whisky or gin for mixed drinks',
    },
    {
      id: 'water-soft',
      label: 'Every guest',
      category: 'Water & soft drinks',
      sharePercent: 100,
      drinksPerGuest: 1,
      drinksPerExtraHour: 1,
      servingsPerBottle: 1,
      listName: 'Water and soft drinks for all guests',
      roundTo: 24,
    },
  ],
};
