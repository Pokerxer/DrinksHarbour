'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {getIngredientProfiles,type IngredientProfile} from '@/services/venue/ingredients';
import IngredientSettings from './ingredient-settings';
import type { Candidate, Menu } from '@/services/venue/experience';
import {
  getRecipes,
  saveRecipe,
  type RecipeGroupDTO,
  type RecipeVersionDTO,
} from '@/services/venue/recipes';
import {
  buttonClass,
  EmptyState,
  fieldClass,
  hintClass,
  Notice,
  panelClass,
} from './controls';
import RecipeForm, {
  RecipeHistory,
  formatCostMinor,
  type RecipeDraft,
} from './recipe-form';

/**
 * S2 recipe versions editor. Lists this location's menu outputs that have
 * recipe versions, edits the active version's components/method/projected
 * cost, and saves by superseding with a NEW version (append-only server
 * contract: `expectedVersion` is the caller's view of the latest version,
 * 0 = none). Profiles are referenced by id — S2 has no profile catalog
 * endpoint, so the picker offers the profiles present in the loaded recipes.
 */

const draftOf = (version: RecipeVersionDTO | null): RecipeDraft => ({
  components: (version?.components || []).map((c) => ({ profile: c.profileId, quantity: String(c.quantity), unit: c.unit, ...(c.stockMapping?{stockMapping:{sourceSubProductId:c.stockMapping.sourceSubProductId,sourceSizeId:c.stockMapping.sourceSizeId,sourceLocationId:c.stockMapping.sourceLocationId,contentQuantity:c.stockMapping.contentQuantity}}:{}) })),
  method: version?.method || '',
  costMinorPerUnit: version?.costMinorPerUnit == null ? '' : String(version.costMinorPerUnit),
});

export default function RecipesEditor({
  token,
  locationId,
  menu,
  catalog = [],
}: {
  token: string;
  locationId: string;
  menu: Menu;
  catalog?: Candidate[];
}) {
  const [profiles,setProfiles]=useState<IngredientProfile[]>([]);
  const refreshProfiles=async()=>setProfiles((await getIngredientProfiles(token,locationId)).items);
  useEffect(()=>{if(menu.schemaVersion!==2)return;let active=true;getIngredientProfiles(token,locationId).then(result=>{if(active)setProfiles(result.items);}).catch(e=>{if(active)setError(e instanceof Error?e.message:'Unable to load ingredient profiles');});return()=>{active=false;};},[token,locationId,menu.schemaVersion]);
  const [groups, setGroups] = useState<RecipeGroupDTO[] | null>(null);
  const [selected, setSelected] = useState('');
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const outputs = useMemo(
    () => new Set(menu.sections.flatMap((s) => s.items.map((i) => `${i.subProductId}:${i.sizeId}`))),
    [menu],
  );
  const knownProfiles = useMemo(() => {
    const ids = new Set<string>(profiles.map(profile=>profile.id));
    for (const group of groups || [])
      for (const version of group.versions)
        for (const component of version.components) ids.add(component.profileId);
    return [...ids];
  }, [groups,profiles]);
  const load = useCallback(async () => {
    const data = await getRecipes(token, locationId);
    return data.items;
  }, [token, locationId]);
  useEffect(() => {
    let active = true;
    load()
      .then((items) => {
        if (active) setGroups(items);
        if (active && items[0]) {
          setSelected(`${items[0].subProductId}:${items[0].sizeId}`);
          setDraft(draftOf(items[0].activeVersion || null));
        }
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load recipes');
      });
    return () => {
      active = false;
    };
  }, [load]);
  const listed = (groups || []).filter((g) =>
    outputs.has(`${g.subProductId}:${g.sizeId}`)||g.isVenueServing===true,
  );
  const group = listed.find((g) => `${g.subProductId}:${g.sizeId}` === selected);
  const active = group?.activeVersion || null;
  const pick = (next: string) => {
    const nextGroup = listed.find((g) => `${g.subProductId}:${g.sizeId}` === next);
    setSelected(next);
    setMessage('');
    setError('');
    setDraft(draftOf(nextGroup?.activeVersion || null));
  };
  const patch = (changes: Partial<RecipeDraft>) =>
    setDraft((current) => ({ ...(current as RecipeDraft), ...changes }));
  const valid =
    !!draft &&
    draft.components.length > 0 &&
    draft.components.every(
      (row) =>
        row.profile &&
        Number(row.quantity) > 0 &&
        (row.unit !== 'count' || Number.isInteger(Number(row.quantity))),
    ) &&
    (draft.costMinorPerUnit === '' ||
      (Number.isInteger(Number(draft.costMinorPerUnit)) && Number(draft.costMinorPerUnit) >= 0));
  async function save() {
    if (!group || !draft || !valid || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const version = await saveRecipe(token, locationId, group.subProductId, {
        sizeId: group.sizeId,
        expectedVersion: active?.version ?? 0,
        input: {
          components: draft.components.map((row) => ({
            profile: row.profile,
            quantity: Number(row.quantity),
            unit: row.unit,
            ...(row.stockMapping?{stockMapping:row.stockMapping}:{}),
          })),
          yieldAssumption: {
            units: active?.yieldAssumption.units || 1,
            ...(active?.yieldAssumption.lossMl != null
              ? { lossMl: active.yieldAssumption.lossMl }
              : {}),
          },
          method: draft.method.trim() || null,
          costMinorPerUnit:
            draft.costMinorPerUnit === '' ? null : Number(draft.costMinorPerUnit),
        },
      });
      setMessage(`Superseded with new version ${version.version}.`);
      const items = await load();
      setGroups(items);
      const refreshed = items.find((g) => `${g.subProductId}:${g.sizeId}` === `${group.subProductId}:${group.sizeId}`);
      setSelected(`${group.subProductId}:${group.sizeId}`);
      setDraft(draftOf(refreshed?.activeVersion || null));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save recipe');
    } finally {
      setBusy(false);
    }
  }
  const nameOf = (subProductId: string) =>
    catalog.find((c) => c.id === subProductId)?.name || subProductId.slice(-6);
  return (
    <section aria-label="Recipe versions" className="space-y-5">
      {menu.schemaVersion===2&&<IngredientSettings token={token} locationId={locationId} profiles={profiles} onSaved={refreshProfiles}/>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Recipe versions</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Recipes define what one serving of a menu output consumes from
            opened bottles and stock. Saving supersedes the current version —
            older versions are never rewritten.
          </p>
        </div>
        <button
          type="button"
          className={buttonClass}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              const items = await load();
              const refreshed = items.find((g) => `${g.subProductId}:${g.sizeId}` === selected) || items[0];
              setGroups(items);
              setSelected(refreshed ? `${refreshed.subProductId}:${refreshed.sizeId}` : '');
              setDraft(refreshed ? draftOf(refreshed.activeVersion) : null);
              setMessage('');
            } catch (e) {
              setError(e instanceof Error ? e.message : 'Unable to refresh');
            } finally { setBusy(false); }
          }}
        >
          <RefreshCcw aria-hidden="true" className="size-4" />
          Reload recipes
        </button>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {message && (
        <Notice tone="success" role="status">
          {message}
        </Notice>
      )}
      {groups && !listed.length && (
        <EmptyState message="No recipes for this location's menu outputs yet. Recipes appear here once a menu beverage has a saved recipe version." />
      )}
      {listed.length > 0 && (
        <label className="block max-w-md text-sm font-medium">
          Menu output
          <select
            className={fieldClass}
            value={selected}
            onChange={(e) => pick(e.target.value)}
          >
            {listed.map((g) => (
              <option key={`${g.subProductId}:${g.sizeId}`} value={`${g.subProductId}:${g.sizeId}`}>
                {nameOf(g.subProductId)} · size {g.sizeId.slice(-6)} · v{g.activeVersion?.version ?? 0}
              </option>
            ))}
          </select>
          <span className={hintClass}>
            {`Projected cost per serving: ${formatCostMinor(active?.costMinorPerUnit ?? null)}${
              active ? ` · yield ${active.yieldAssumption.units} serving(s) per recipe` : ''
            }`}
          </span>
        </label>
      )}
      {group && draft && (
        <RecipeForm
          profiles={profiles} locationId={menu.schemaVersion===2?locationId:undefined}
          draft={draft}
          active={active}
          knownProfiles={knownProfiles}
          busy={busy}
          valid={valid}
          dirty={JSON.stringify(draft) !== JSON.stringify(draftOf(active))}
          nextVersion={(active?.version ?? 0) + 1}
          onPatch={patch}
          onPatchRow={(index, changes) =>
            patch({
              components: draft.components.map((row, i) =>
                i === index ? { ...row, ...changes } : row,
              ),
            })
          }
          onRemoveRow={(index) =>
            patch({ components: draft.components.filter((_, i) => i !== index) })
          }
          onAddRow={() =>
            patch({
              components: [
                ...draft.components,
                { profile: '', quantity: '1', unit: 'ml' },
              ],
            })
          }
          onSave={() => void save()}
        />
      )}
      {!!group && <RecipeHistory group={group} />}
    </section>
  );
}
