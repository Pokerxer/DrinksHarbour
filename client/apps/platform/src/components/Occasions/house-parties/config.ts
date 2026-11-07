import type { CalcConfig } from '@/lib/occasions/types';

/**
 * House-party consumption plan. Shares are independent — water can serve every
 * guest while wine serves a third — they are not percentages summing to 100.
 * Beers round to a 24-can case and 75cl water/mixer rounds to a 24-bottle case.
 * No prices appear anywhere; lines join the request list as name + quantity.
 */
export const housePartyCalcConfig: CalcConfig = {
  heading: 'House party drink calculator',
  intro: 'Enter your guest count and how long the party runs. The estimate covers beer or cans, spirits for mixing cocktails, wine for anyone dining and water or mixers for everybody. The shares are independent — guests can enjoy more than one option — and the results are planning suggestions only.',
  rows: [
    {
      id: 'beers',
      label: 'Beers & cans',
      category: 'Beers & cans',
      sharePercent: 70,
      drinksPerGuest: 2,
      drinksPerExtraHour: 1,
      servingsPerBottle: 1,
      listName: 'Beer (cans)',
      roundTo: 24,
    },
    {
      id: 'spirits',
      label: 'Spirits for mixing',
      category: 'Spirits for mixing',
      sharePercent: 40,
      drinksPerGuest: 1,
      drinksPerExtraHour: 1,
      servingsPerBottle: 23,
      listName: 'Spirits for mixing (cocktails)',
    },
    {
      id: 'wine',
      label: 'Wine for dinner',
      category: 'Wine',
      sharePercent: 30,
      drinksPerGuest: 2,
      drinksPerExtraHour: 0.5,
      servingsPerBottle: 5,
      listName: 'Wine for dinner',
    },
    {
      id: 'mixers',
      label: 'Water & mixers',
      category: 'Water & mixers',
      sharePercent: 100,
      drinksPerGuest: 2,
      drinksPerExtraHour: 1,
      servingsPerBottle: 3,
      listName: 'Water & soft drinks (75cl)',
      roundTo: 24,
    },
  ],
};
