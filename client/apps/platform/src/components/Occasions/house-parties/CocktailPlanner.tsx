'use client';

import { useState } from 'react';
import type { BottleChoice } from '@/lib/weddingBottleList';
import { COCKTAIL_RECIPES, MAX_SERVINGS, cocktailRequirements } from './cocktailPlan';

type Props = { onUse: (choices: BottleChoice[]) => void };

const buttonClass = 'min-h-10 rounded-full border border-rose-200 bg-white px-4 py-2 text-xs font-semibold text-[#7c1d1d] hover:border-[#7c1d1d] hover:bg-[#fff8ec] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d] disabled:cursor-not-allowed disabled:opacity-40';

/**
 * Deterministic cocktail picker for house parties: choose a recipe, enter
 * servings, see required spirit/mixer bottles. Quantities only — no prices.
 */
export default function CocktailPlanner({ onUse }: Props) {
  const [recipeId, setRecipeId] = useState(COCKTAIL_RECIPES[0].id);
  const [servingsInput, setServingsInput] = useState('12');
  const parsed = Number(servingsInput);
  const result = cocktailRequirements(recipeId, parsed);
  const ready = result.servings > 0;

  return <section className="rounded-2xl border border-gray-200 bg-white p-6" aria-label="Cocktail plan">
    <h3 className="text-xl font-bold text-gray-900">Cocktail plan for two or three drinks</h3>
    <p className="mt-2 text-sm leading-6 text-gray-600">Pick a recipe, enter how many servings you expect, and we add up the spirit and mixer bottles behind it. Quantities are planning estimates only — totals and availability are confirmed with our team before you order.</p>
    <fieldset className="mt-4">
      <legend className="text-sm font-semibold text-gray-700">Recipe</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {COCKTAIL_RECIPES.map(recipe => <label key={recipe.id} className={`flex min-h-11 cursor-pointer items-start gap-2 rounded-xl border p-3 text-sm ${recipe.id === recipeId ? 'border-[#7c1d1d] bg-[#fff8ec]' : 'border-gray-200'}`}>
          <input type="radio" name="cocktail-recipe" value={recipe.id} checked={recipe.id === recipeId}
            onChange={() => setRecipeId(recipe.id)}
            className="mt-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
          <span><span className="font-semibold text-gray-900">{recipe.name}</span><span className="mt-1 block text-xs leading-5 text-gray-600">{recipe.blurb}</span></span>
        </label>)}
      </div>
    </fieldset>
    <div className="mt-4">
      <label htmlFor="cocktail-servings" className="text-sm font-semibold text-gray-700">Servings
        <input id="cocktail-servings" type="number" min={1} max={MAX_SERVINGS} inputMode="numeric" value={servingsInput}
          onChange={event => setServingsInput(event.target.value)}
          className="mt-1 block w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]" />
      </label>
    </div>
    <div aria-live="polite">
      <table className="mt-5 w-full text-left text-sm">
        <caption className="sr-only">{result.recipe ? `${result.recipe.name} required bottles` : 'Required bottles'}</caption>
        <thead><tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500"><th scope="col" className="py-2">Ingredient</th><th scope="col" className="py-2">Type</th><th scope="col" className="py-2 text-right">Required</th><th scope="col" className="py-2"><span className="sr-only">Add</span></th></tr></thead>
        <tbody>
          {ready && result.lines.map(line => <tr key={line.name} className="border-b border-gray-100 align-top">
            <td className="py-3 pr-4 font-semibold text-gray-900">{line.name}</td>
            <td className="py-3 pr-4 text-gray-600">{line.kind === 'spirit' ? 'Spirit' : 'Mixer'}</td>
            <td className="py-3 pr-4 text-right font-bold text-gray-900">{line.bottles.toLocaleString('en-NG')} {line.bottles === 1 ? 'bottle' : 'bottles'}</td>
            <td className="py-3 text-right"><button type="button" onClick={() => onUse([{ name: line.name, suggestedQuantity: line.bottles }])} className={buttonClass}>Add to list</button></td>
          </tr>)}
          {!ready && <tr><td colSpan={4} className="py-3 text-gray-600">Enter a serving count between 1 and {MAX_SERVINGS} to build the list.</td></tr>}
        </tbody>
      </table>
      {ready && result.recipe && <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => onUse(result.choices)} className="min-h-11 rounded-full bg-[#7c1d1d] px-5 py-3 text-sm font-bold text-white hover:bg-[#571419] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7c1d1d]">Add all {result.recipe.name} ingredients to your list</button>
      </div>}
      <p className="mt-3 text-xs leading-5 text-gray-500">{result.recipe ? result.recipe.note : ''} Pour sizes are typical; adjust for your glasses and drinking pace.</p>
    </div>
  </section>;
}
