'use client';
import { useEffect, useState } from 'react';
import type { Candidate, Menu } from '@/services/venue/experience';
import { listServings, type Serving } from '@/services/venue/costing';
import { getRecipes, type RecipeGroupDTO } from '@/services/venue/recipes';
import MenuEditor from './menu-editor';
import MenuCategoryEditor from './menu-category-editor';
import { buttonClass, Notice } from './controls';
export default function MenuSetup({
  token,
  locationId,
  value,
  catalog,
  more,
  onMore,
  onSave,
  busy,
}: {
  token: string;
  locationId: string;
  value: Menu;
  catalog: Candidate[];
  more: boolean;
  onMore: () => void;
  onSave: (menu: Menu) => Promise<void>;
  busy: boolean;
}) {
  const [v2, setV2] = useState(value.schemaVersion === 2);
  const [servings, setServings] = useState<Serving[]>([]);
  const [recipes, setRecipes] = useState<RecipeGroupDTO[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!v2) return;
    let active = true;
    Promise.all([
      listServings(token, locationId),
      getRecipes(token, locationId),
    ])
      .then(([rows, versions]) => {
        if (active) {
          setServings(rows.items);
          setRecipes(versions.items);
        }
      })
      .catch((e) => {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : 'Unable to load serving definitions',
          );
      });
    return () => {
      active = false;
    };
  }, [v2, token, locationId]);
  if (!v2)
    return (
      <div className="space-y-5">
        <button className={buttonClass} onClick={() => setV2(true)}>
          Start a portion menu draft
        </button>
        <MenuEditor
          value={value}
          catalog={catalog}
          more={more}
          onMore={onMore}
          onSave={onSave}
          busy={busy}
        />
      </div>
    );
  return (
    <div className="space-y-4">
      {value.schemaVersion !== 2 && (
        <Notice
          tone="info"
          action={
            <button className={buttonClass} onClick={() => setV2(false)}>
              Return to current menu
            </button>
          }
        >
          This replacement draft starts empty. Saving replaces the current menu
          placements. Existing accepted orders keep their original prices and
          serving snapshots.
        </Notice>
      )}
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      <MenuCategoryEditor
        value={
          value.schemaVersion === 2
            ? value
            : { schemaVersion: 2, sections: [], categories: [] }
        }
        onSave={onSave}
        busy={busy}
        servings={servings}
        recipes={recipes}
      />
    </div>
  );
}
