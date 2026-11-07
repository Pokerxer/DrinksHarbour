'use client';
import { useEffect, useState } from 'react';
import {
  createIngredientProfile,
  getIngredientCandidates,
  type IngredientProfile,
} from '@/services/venue/ingredients';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export default function IngredientSettings({
  token,
  locationId,
  profiles,
  onSaved,
}: {
  token: string;
  locationId: string;
  profiles: IngredientProfile[];
  onSaved: () => Promise<void>;
}) {
  const [sources, setSources] = useState<{ id: string; name: string }[]>([]);
  const [product, setProduct] = useState('');
  const [dimension, setDimension] = useState<'count' | 'mass' | 'volume'>(
    'mass',
  );
  const [perishable, setPerishable] = useState(false);
  const [allergens, setAllergens] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    getIngredientCandidates(token, locationId)
      .then((result) => {
        if (active) setSources(result.items);
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error ? e.message : 'Unable to load stock items',
          );
      });
    return () => {
      active = false;
    };
  }, [token, locationId]);
  return (
    <details className={panelClass}>
      <summary className="min-h-11 cursor-pointer font-semibold">
        Ingredient setup
      </summary>
      <p className="my-3 text-sm">
        Use an owned stock item. Declare only known allergens from supplier
        information; a blank declaration means unknown.
      </p>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            await createIngredientProfile(token, locationId, {
              subProductId: product,
              dimension,
              perishable,
              allergenSource: allergens
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean),
            });
            await onSaved();
            setProduct('');
          } catch (e) {
            setError(
              e instanceof Error ? e.message : 'Unable to save ingredient',
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          Ingredient stock item
          <select
            className={fieldClass}
            required
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">Choose stock item</option>
            {sources
              .filter(
                (item) =>
                  !profiles.some((profile) => profile.subProductId === item.id),
              )
              .map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Ingredient measurement
          <select
            className={fieldClass}
            value={dimension}
            onChange={(e) => setDimension(e.target.value as typeof dimension)}
          >
            <option value="mass">Mass (g)</option>
            <option value="volume">Volume (ml)</option>
            <option value="count">Whole units</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={perishable}
            onChange={(e) => setPerishable(e.target.checked)}
          />
          Perishable ingredient
        </label>
        <label>
          Known allergen codes, separated by commas
          <input
            className={fieldClass}
            value={allergens}
            onChange={(e) => setAllergens(e.target.value)}
            placeholder="milk, gluten"
          />
        </label>
        <button className={buttonClass} disabled={busy || !product}>
          Create ingredient profile
        </button>
      </form>
    </details>
  );
}
