import { describe, expect, it } from 'vitest';
import {
  catalogBusiness,
  matchesBusiness,
  businessFacts,
} from './catalog-business';

describe('business catalog presentation', () => {
  it.each([
    ['beauty_skincare', 'beauty'],
    ['home_lighting', 'home'],
    ['electronics_laptop', 'electronics'],
    ['foodservice_produce', 'food-service'],
    ['hospitality_linen', 'hospitality'],
    ['fashion_shirt', 'fashion'],
    ['wine', 'beverage'],
  ])('classifies %s', (type, expected) => {
    expect(catalogBusiness(type)).toBe(expected);
  });
  it('leaves unknown and missing types in the general catalog', () => {
    expect(catalogBusiness('unclassified')).toBe('all');
    expect(catalogBusiness()).toBe('all');
    expect(matchesBusiness('home_lighting', 'all')).toBe(true);
    expect(matchesBusiness('beauty_skincare', 'home')).toBe(false);
  });
  it('does not present alcohol facts on beauty or make missing ingredient claims', () => {
    const facts = businessFacts({
      type: 'beauty_skincare',
      ingredients: ['Aloe'],
      abv: 30,
    });
    expect(facts).toContainEqual(['Ingredients', 'Aloe']);
    expect(facts.some(([label]) => label === 'ABV')).toBe(false);
    expect(businessFacts({ type: 'foodservice_produce' })).toContainEqual([
      'Allergens',
      'Not recorded',
    ]);
  });
});

it.each([
  'champagne',
  'lager',
  'whisky',
  'espresso',
  'oat_milk',
  'non_alcoholic_spirit',
])('includes legacy %s in Beverage view', (type) => {
  expect(catalogBusiness(type)).toBe('beverage');
  expect(matchesBusiness(type, 'beverage')).toBe(true);
});

it.each(['other', 'accessory', 'gift_set', 'snack'])('does not classify %s as a drink', type => { expect(catalogBusiness(type)).toBe('all'); });
