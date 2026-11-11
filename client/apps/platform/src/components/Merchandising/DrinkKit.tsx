'use client';

import { PiMartini, PiCheck, PiPlus } from 'react-icons/pi';
import styles from './merchandising.module.css';
import { useOfferImpression } from './useOfferImpression';
import { useEffect, useId, useMemo, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { useShoppingLocation } from '@/context/ShoppingLocationContext';
import { money, offerIdentity } from './offers';
import { kitRecipes } from './kitRecipes';
import { getKitContents, resolveDrinkKit, restoreKitTaxonomy } from './resolveDrinkKit';
import { useAddSuggestedOffers } from './useAddSuggestedOffers';

type KitResult = {
  key: string;
  kit: Awaited<ReturnType<typeof resolveDrinkKit>>;
};

export default function DrinkKit() {
  const { cartState } = useCart();
  const { location, revision } = useShoppingLocation();
  const { add, busy, message, offerRevision } = useAddSuggestedOffers();
  const titleId = useId();
  const [manualRecipe, setManualRecipe] = useState<string | null>(null);
  const [result, setResult] = useState<KitResult | null>(null);
  const [excluded, setExcluded] = useState<string[]>([]);
  const lines = cartState.cartArray;
  const key = useMemo(() => JSON.stringify([manualRecipe, revision, lines.map(line => [
    line.id, line.selectedProductId, line.selectedVendorId, line.tenantId, line.type, line.subType,
    line.category, line.subCategory, line.name, line.isAlcoholic, line.abv,
  ]), offerRevision]), [lines, manualRecipe, revision, offerRevision]);

  useEffect(() => {
    if (manualRecipe === '' || (!lines.length && manualRecipe === null)) return;
    const controller = new AbortController();
    const request = { location, signal: controller.signal };
    void (async () => {
      const currentLines = await restoreKitTaxonomy(lines, request);
      if (controller.signal.aborted) return;
      const recipes = kitRecipes.filter(recipe => {
        if (manualRecipe !== null) return recipe.name === manualRecipe;
        const { base, mixer } = getKitContents(recipe, currentLines);
        return Boolean(base) !== Boolean(mixer);
      });
      const results = await Promise.all(recipes.map(recipe => resolveDrinkKit(recipe, currentLines, request)));
      if (controller.signal.aborted) return;
      const available = results.filter((kit): kit is NonNullable<typeof kit> => kit !== null && (manualRecipe !== null || kit.missing.length > 0));
      available.sort((a, b) => b.present - a.present || Number(b.sameSeller) - Number(a.sameSeller));
      setResult({ key, kit: available[0] ?? null });
    })();
    return () => controller.abort();
  }, [lines, key, location, manualRecipe]);

  const current = result?.key === key ? result : null;
  const kit = current?.kit;
  const recipeName = manualRecipe ?? kit?.recipe.name ?? '';
  const items = kit?.items;
  const loading = Boolean(manualRecipe) && !current;
  const selected = (items ?? []).flatMap(item =>
    'offer' in item && !excluded.includes(offerIdentity(item.offer)) ? [item.offer] : [],
  );

  const total = selected.reduce((sum, offer) => sum + offer.price, 0);
  const ref = useOfferImpression<HTMLElement>('cart_kit', items?.length ? recipeName : undefined);
  return (
    <section ref={ref} aria-labelledby={titleId} className={`${styles.panel} my-5 space-y-3`}>
      <h2 id={titleId} className={`${styles.title} flex items-center gap-2`}><PiMartini aria-hidden /> {manualRecipe === null && kit ? kit.recipe.prompt : 'Build a drink kit'}</h2>
      <label className="block text-sm font-medium text-gray-800">
        Choose a kit
        <select value={recipeName} disabled={busy} className={`${styles.control} mt-1 block w-full rounded-xl border border-[#ead9df] bg-white px-3 py-2.5 sm:ml-2 sm:mt-0 sm:inline-block sm:w-auto`}
          onChange={event => { setManualRecipe(event.target.value); setExcluded([]); }}>
          <option value="">Select a recipe</option>
          {kitRecipes.map(item => <option key={item.name}>{item.name}</option>)}
        </select>
      </label>
      {loading && (
        <div className="space-y-2">
          <p role="status" className="text-sm text-gray-600">Checking available ingredients…</p>
          <div aria-hidden className="h-10 rounded-xl bg-[#f2e4e9] motion-safe:animate-pulse" />
        </div>
      )}
      {manualRecipe && current && !kit && <p className="text-sm text-gray-600">This kit needs more in-stock ingredients. Try another recipe.</p>}
      {!!items?.length && (
        <div key={recipeName} className={`${styles.reveal} ${styles.ticket} space-y-2`}>
          <p className="text-sm text-gray-600">{selected.length ? 'Choose which missing ingredients to add.' : 'Select any ingredients you need.'}</p>
          {items.map(item => {
            if ('inCart' in item) return <p key={item.inCart} className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-gray-700"><PiCheck aria-hidden /> {item.inCart} · In your cart</p>;
            const { offer } = item;
            const id = offerIdentity(offer);
            return (
              <label key={id} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#ead9df] bg-white px-3 py-2.5 text-sm">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-[#781934]" checked={!excluded.includes(id)} disabled={busy}
                  onChange={event => setExcluded(previous => event.target.checked ? previous.filter(value => value !== id) : [...previous, id])} />
                <span className="min-w-0 flex-1">
                  <strong className="block break-words">{offer.product.name}</strong>
                  <span className="text-xs text-gray-600">{offer.size.displayName || offer.size.size} · {offer.seller.tenant.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{money(offer.price)}</span>
              </label>
            );
          })}
          <div className={`${styles.ticket} mt-3 flex flex-wrap items-center justify-between gap-2`}>
            <span className="text-xs font-semibold text-gray-700">{selected.length} selected</span>
            <button type="button" disabled={busy || !selected.length} className={styles.button}
              onClick={() => void add(selected, 'cart_kit')}>
              <PiPlus aria-hidden /> Add selected · <span key={total} className={`${styles.amount} tabular-nums`}>{money(total)}</span>
            </button>
          </div>
        </div>
      )}
      <p role="status" className="text-sm text-gray-600">{busy ? 'Checking price and stock…' : message}</p>
    </section>
  );
}
