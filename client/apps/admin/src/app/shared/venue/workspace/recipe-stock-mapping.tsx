'use client';
import type {
  IngredientProfile,
  StockMappingInput,
} from '@/services/venue/ingredients';
import { fieldClass } from './controls';
export default function RecipeStockMapping({
  profile,
  locationId,
  unit,
  value,
  onChange,
}: {
  profile?: IngredientProfile;
  locationId: string;
  unit: 'count' | 'g' | 'ml';
  value?: StockMappingInput;
  onChange: (value: StockMappingInput | undefined) => void;
}) {
  if (!profile) return null;
  const scale = unit === 'count' ? 1 : 100;
  const patch = (changes: Partial<StockMappingInput>) =>
    onChange({
      sourceSubProductId: profile.subProductId,
      sourceSizeId: value?.sourceSizeId || '',
      sourceLocationId: locationId,
      contentQuantity: value?.contentQuantity || {
        amountScaled: scale,
        scale,
        unit,
      },
      ...changes,
    });
  return (
    <details
      className="w-full rounded-lg border border-muted p-3"
      open={!!value}
    >
      <summary className="cursor-pointer text-sm font-medium">
        Physical stock form for {profile.name}
      </summary>
      <p className="mt-2 text-xs">
        Choose the stock form and measured content of one stock unit. Saving
        records your review. Without this mapping the recipe remains a ledger
        estimate.
      </p>
      <label className="block text-sm">
        Ingredient stock form
        <select
          className={fieldClass}
          value={value?.sourceSizeId || ''}
          onChange={(e) => {
            if (!e.target.value) onChange(undefined);
            else patch({ sourceSizeId: e.target.value });
          }}
        >
          <option value="">Not physically mapped</option>
          {profile.stockForms.map((form) => (
            <option key={form.id} value={form.id}>
              {form.name}
            </option>
          ))}
        </select>
      </label>
      {value && (
        <label className="block text-sm">
          Content per stock unit ({unit})
          <input
            className={fieldClass}
            type="number"
            min={1 / scale}
            step={1 / scale}
            value={value.contentQuantity.amountScaled / scale}
            onChange={(e) =>
              patch({
                contentQuantity: {
                  amountScaled: Math.round(Number(e.target.value) * scale),
                  scale,
                  unit,
                },
              })
            }
          />
        </label>
      )}
    </details>
  );
}
