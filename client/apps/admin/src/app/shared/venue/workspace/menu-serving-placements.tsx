'use client';
import type { Menu } from '@/services/venue/experience';
import type { Serving } from '@/services/venue/costing';
import type { RecipeGroupDTO } from '@/services/venue/recipes';
import { buttonClass, fieldClass } from './controls';
export default function MenuServingPlacements({
  section,
  menu,
  servings,
  recipes,
  onChange,
}: {
  section: Menu['sections'][number];
  menu: Menu;
  servings: Serving[];
  recipes: RecipeGroupDTO[];
  onChange: (section: Menu['sections'][number]) => void;
}) {
  const categories = (menu.categories || []).filter(
    (row) => row.sectionId === section.id,
  );
  return (
    <div className="space-y-3">
      <label className="block">
        Add serving to {section.name}
        <select
          className={fieldClass}
          value=""
          disabled={!categories.length}
          onChange={(e) => {
            const serving = servings.find((row) => row.id === e.target.value);
            if (!serving) return;
            const recipe = recipes.find(
              (group) =>
                group.subProductId === serving.subProductId &&
                group.sizeId === serving.id,
            )?.activeVersion;
            onChange({
              ...section,
              items: [
                ...section.items,
                {
                  menuItemId: crypto.randomUUID(),
                  categoryId: categories[0].id,
                  subProductId: serving.subProductId,
                  sizeId: serving.id,
                  servingVersion: serving.version,
                  modifierSchemaVersion: 2,
                  published: false,
                  ...(recipe ? { acceptedRecipeVersionId: recipe.id } : {}),
                },
              ],
            });
          }}
        >
          <option value="">Choose a serving definition</option>
          {servings
            .filter(
              (row) => !section.items.some((item) => item.sizeId === row.id),
            )
            .map((row) => (
              <option value={row.id} key={row.id}>
                {row.displayName} · {row.code}
              </option>
            ))}
        </select>
      </label>
      {!categories.length && (
        <p className="text-sm">Add a category before placing servings.</p>
      )}
      {section.items.map((item, index) => {
        const serving = servings.find((row) => row.id === item.sizeId);
        const recipe = recipes.find(
          (group) =>
            group.subProductId === item.subProductId &&
            group.sizeId === item.sizeId,
        )?.activeVersion;
        return (
          <fieldset
            className="space-y-3 rounded-lg border border-muted p-3"
            key={item.menuItemId || item.sizeId}
          >
            <legend>
              {serving?.displayName || item.display || `Serving ${index + 1}`}
            </legend>
            <label>
              Menu category
              <select
                className={fieldClass}
                value={item.categoryId}
                onChange={(e) =>
                  onChange({
                    ...section,
                    items: section.items.map((row, n) =>
                      n === index
                        ? { ...row, categoryId: e.target.value }
                        : row,
                    ),
                  })
                }
              >
                {categories.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm">
              {item.acceptedRecipeVersionId
                ? 'Reviewed serving recipe attached'
                : 'No serving recipe attached'}
              . A changed serving requires refreshing this menu item.
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={item.published}
                disabled={
                  !!serving &&
                  ['made_to_order', 'prepared_batch'].includes(serving.mode) &&
                  !recipe
                }
                onChange={(e) =>
                  onChange({
                    ...section,
                    items: section.items.map((row, n) =>
                      n === index
                        ? { ...row, published: e.target.checked }
                        : row,
                    ),
                  })
                }
              />
              Show on menu
            </label>
            <button
              type="button"
              className={buttonClass}
              onClick={() =>
                onChange({
                  ...section,
                  items: section.items.filter((_, n) => n !== index),
                })
              }
            >
              Remove placement
            </button>
          </fieldset>
        );
      })}
    </div>
  );
}
