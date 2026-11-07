import type { BottleChoice } from '@/lib/weddingBottleList';

/**
 * Deterministic cocktail planning data for house parties. A local lookup table:
 * no AI, no prices, no client-side monetary math. Required quantities are
 * computed from pour sizes against standard bottle volumes and join the request
 * list as BottleChoice name + quantity only.
 */
export type CocktailIngredient = {
  /** Entry name used when this ingredient is added to the request list. */
  name: string;
  kind: 'spirit' | 'mixer';
  /** Millilitres poured per serving. */
  mlPerServing: number;
  /** Usable millilitres in one purchased bottle or carton. */
  mlPerBottle: number;
};

export type CocktailRecipe = {
  id: string;
  name: string;
  blurb: string;
  /** Not part of a drinks order — shown as an honest reminder. */
  note: string;
  ingredients: CocktailIngredient[];
};

export const MAX_SERVINGS = 200;

export const COCKTAIL_RECIPES: CocktailRecipe[] = [
  {
    id: 'gin-tonic',
    name: 'Gin & tonic',
    blurb: 'Gin over ice with tonic or soda and a squeeze of lime. The easiest one to keep going all night.',
    note: 'Ice, cups, lime and garnish are not part of a drinks order — plan them separately.',
    ingredients: [
      { name: 'Gin for cocktails', kind: 'spirit', mlPerServing: 50, mlPerBottle: 700 },
      { name: 'Tonic or soda water', kind: 'mixer', mlPerServing: 150, mlPerBottle: 1000 },
    ],
  },
  {
    id: 'vodka-orange',
    name: 'Vodka & orange',
    blurb: 'Vodka and chilled orange juice over ice. Safest pick for guests who avoid bitter drinks.',
    note: 'Juice keeps better chilled; plan cooler space and ice, which are arranged separately.',
    ingredients: [
      { name: 'Vodka for mixing', kind: 'spirit', mlPerServing: 50, mlPerBottle: 750 },
      { name: 'Orange juice cartons', kind: 'mixer', mlPerServing: 150, mlPerBottle: 1000 },
    ],
  },
  {
    id: 'chapman',
    name: 'Chapman',
    blurb: 'Blackcurrant cordial, Angostura bitters and lemon-lime soft drink, built tall with ice. A Nigerian table favourite.',
    note: 'One small bottle of bitters covers many parties. Ice, cups and cucumber garnish are arranged separately.',
    ingredients: [
      { name: 'Blackcurrant cordial', kind: 'mixer', mlPerServing: 30, mlPerBottle: 1000 },
      { name: 'Lemon-lime soft drinks', kind: 'mixer', mlPerServing: 150, mlPerBottle: 500 },
      { name: 'Angostura bitters', kind: 'spirit', mlPerServing: 5, mlPerBottle: 200 },
    ],
  },
];

/**
 * Returns 0 when the input is unusable or out of range, matching the planning
 * tools' numeric conventions; the UI disables adding until it is non-zero.
 */
export function clampedServings(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const rounded = Math.round(value);
  return rounded >= 1 && rounded <= MAX_SERVINGS ? rounded : 0;
}

export type CocktailLine = { name: string; kind: CocktailIngredient['kind']; bottles: number };

export function cocktailRequirements(recipeId: string, rawServings: number): {
  recipe: CocktailRecipe | undefined;
  servings: number;
  lines: CocktailLine[];
  choices: BottleChoice[];
} {
  const recipe = COCKTAIL_RECIPES.find(entry => entry.id === recipeId);
  const servings = clampedServings(rawServings);
  if (!recipe || !servings) return { recipe, servings: 0, lines: [], choices: [] };
  const lines = recipe.ingredients.map(ingredient => ({
    name: ingredient.name,
    kind: ingredient.kind,
    bottles: Math.ceil(servings * ingredient.mlPerServing / ingredient.mlPerBottle),
  }));
  return {
    recipe,
    servings,
    lines,
    choices: lines.map(line => ({ name: line.name, suggestedQuantity: line.bottles })),
  };
}
