'use client';
import { Plus, Save, X } from 'lucide-react';
import type {IngredientProfile,StockMappingInput} from '@/services/venue/ingredients';
import RecipeStockMapping from './recipe-stock-mapping';
import type { RecipeVersionDTO } from '@/services/venue/recipes';
import {
  buttonClass,
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  UnsavedHint,
} from './controls';

/**
 * Editing form for one recipe output's next version: component rows
 * (profile + quantity + unit), method text and the projected cost input.
 * Pure presentation — all state lives in `recipes-editor.tsx`, which owns the
 * draft and the supersede-with-new-version save (`expectedVersion` semantics).
 */

export type DraftRow = { stockMapping?:StockMappingInput; profile: string; quantity: string; unit: 'count' | 'ml' | 'g' };

/** Projected authoring cost readout — null cost is 'unknown', never guessed. */
export const formatCostMinor = (costMinorPerUnit: number | null) =>
  costMinorPerUnit == null
    ? 'unknown'
    : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(costMinorPerUnit / 100);
export type RecipeDraft = {
  components: DraftRow[];
  method: string;
  costMinorPerUnit: string;
};

export default function RecipeForm({
  profiles = [], locationId,
  draft,
  active,
  knownProfiles,
  busy,
  valid,
  dirty,
  nextVersion,
  onPatch,
  onPatchRow,
  onRemoveRow,
  onAddRow,
  onSave,
}: {
  profiles?:IngredientProfile[];locationId?:string;
  draft: RecipeDraft;
  active: RecipeVersionDTO | null;
  knownProfiles: string[];
  busy: boolean;
  valid: boolean;
  dirty: boolean;
  nextVersion: number;
  onPatch: (changes: Partial<RecipeDraft>) => void;
  onPatchRow: (index: number, changes: Partial<DraftRow>) => void;
  onRemoveRow: (index: number) => void;
  onAddRow: () => void;
  onSave: () => void;
}) {
  return (
    <form
      className={`${panelClass} space-y-4`}
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
    >
      <fieldset className="space-y-3">
        <legend className="px-1 text-base font-semibold">
          Components (what one recipe serving consumes)
        </legend>
        {draft.components.map((row, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            {locationId&&<RecipeStockMapping profile={profiles.find(profile=>profile.id===row.profile)} locationId={locationId} unit={row.unit} value={row.stockMapping} onChange={value=>onPatchRow(index,{stockMapping:value})}/>}
            <label className="block min-w-40 flex-1 text-sm font-medium">
              Component {index + 1} profile
              <select
                className={fieldClass}
                value={row.profile}
                onChange={(e) => { const profile=profiles.find(row=>row.id===e.target.value);onPatchRow(index, { profile: e.target.value, stockMapping:undefined, ...(profile?{unit:profile.dimension==='mass'?'g':profile.dimension==='volume'?'ml':'count'}:{}) }); }}
              >
                <option value="">Choose profile</option>
                {knownProfiles.map((profileId) => (
                  <option key={profileId} value={profileId}>
                    {profiles.find(profile=>profile.id===profileId)?.name||`Profile …${profileId.slice(-6)}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="block w-28 text-sm font-medium">
              Quantity
              <input
                type="number"
                step="any"
                min="0"
                className={fieldClass}
                value={row.quantity}
                onChange={(e) => onPatchRow(index, { quantity: e.target.value })}
              />
            </label>
            <label className="block w-24 text-sm font-medium">
              Unit
              <select
                className={fieldClass}
                value={row.unit}
                onChange={(e) =>
                  onPatchRow(index, { unit: e.target.value as DraftRow['unit'] })
                }
              >
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="count">count</option>
              </select>
            </label>
            <button
              type="button"
              className={buttonClass}
              aria-label={`Remove component ${index + 1}`}
              onClick={() => onRemoveRow(index)}
            >
              <X aria-hidden="true" className="size-4" />
            </button>
          </div>
        ))}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className={buttonClass} onClick={onAddRow}>
            <Plus aria-hidden="true" className="size-4" />
            Add component row
          </button>
          <span className={hintClass}>
            S2 has no profile catalog endpoint yet — pick a profile already used
            by this tenant's recipes.
          </span>
        </div>
      </fieldset>
      <label className="block max-w-xl text-sm font-medium">
        Method
        <textarea
          rows={3}
          maxLength={2000}
          className={fieldClass}
          value={draft.method}
          onChange={(e) => onPatch({ method: e.target.value })}
        ></textarea>
      </label>
      <label className="block max-w-xs text-sm font-medium">
        Projected cost per serving (kobo)
        <input
          type="number"
          min="0"
          className={fieldClass}
          value={draft.costMinorPerUnit}
          onChange={(e) => onPatch({ costMinorPerUnit: e.target.value })}
        />
        <span className={hintClass}>
          Leave blank for an unknown cost — it is never guessed.
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={primaryButtonClass} disabled={busy || !valid}>
          <Save aria-hidden="true" className="size-4" />
          Supersede with new version
        </button>
        <UnsavedHint dirty={dirty} />
      </div>
      <p className={hintClass}>
        Saving creates version {nextVersion} and keeps every older version
        readable in the history below.
      </p>
    </form>
  );
}

/** Read-only version history for one output: newest versions stay readable forever. */
export function RecipeHistory({ group }: { group: { versions: RecipeVersionDTO[] } }) {
  return (
    <div className={`${panelClass} space-y-2`}>
      <h3 className="text-base font-semibold">Version history</h3>
      {group.versions.map((version) => (
        <p
          key={version.id}
          className="text-sm tabular-nums text-gray-600 dark:text-gray-300"
        >
          v{version.version} · {version.components.length} component(s) · cost{' '}
          {formatCostMinor(version.costMinorPerUnit)}
          {version.supersededBy ? ' · superseded' : ' · active'}
        </p>
      ))}
    </div>
  );
}
