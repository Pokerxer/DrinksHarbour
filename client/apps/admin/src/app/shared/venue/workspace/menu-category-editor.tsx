'use client';
import { useState } from 'react';
import type { Serving } from '@/services/venue/costing';
import type { RecipeGroupDTO } from '@/services/venue/recipes';
import MenuServingPlacements from './menu-serving-placements';
import type { Menu } from '@/services/venue/experience';
import { buttonClass, fieldClass, Notice, panelClass } from './controls';
export type MenuCategory = {
  id: string;
  sectionId: string;
  parentId: string | null;
  name: string;
  sortOrder: number;
};
export default function MenuCategoryEditor({
  value,
  onSave,
  busy,
  servings = [],
  recipes = [],
}: {
  value: Menu;
  onSave: (menu: Menu) => Promise<void>;
  busy: boolean;
  servings?: Serving[];
  recipes?: RecipeGroupDTO[];
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const categories = draft.categories || [];
  const patch = (id: string, changes: Partial<MenuCategory>) =>
    setDraft((previous) => ({
      ...previous,
      categories: (previous.categories || []).map((row) =>
        row.id === id ? { ...row, ...changes } : row,
      ),
    }));
  const move = (id: string, direction: number) => {
    const row = categories.find((item) => item.id === id);
    if (!row) return;
    const siblings = categories
      .filter(
        (item) =>
          item.sectionId === row.sectionId && item.parentId === row.parentId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const index = siblings.findIndex((item) => item.id === id);
    const other = siblings[index + direction];
    if (!other) return;
    setDraft((previous) => ({
      ...previous,
      categories: (previous.categories || []).map((item) =>
        item.id === id
          ? { ...item, sortOrder: other.sortOrder }
          : item.id === other.id
            ? { ...item, sortOrder: row.sortOrder }
            : item,
      ),
    }));
  };
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError('');
        try {
          await onSave(draft);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : 'Unable to save categories',
          );
        }
      }}
    >
      <div className={panelClass}>
        <h2 className="text-xl font-semibold">Menu sections and categories</h2>
        <p className="mt-2 text-sm">
          Categories organise this location’s menu. Renaming or moving one keeps
          its serving and kitchen references intact.
        </p>
      </div>
      {error && (
        <Notice tone="error" role="alert">
          {error}
        </Notice>
      )}
      {draft.sections.map((section) => (
        <section className={`${panelClass} space-y-3`} key={section.id}>
          <label className="block font-semibold">
            Section name
            <input
              className={fieldClass}
              required
              value={section.name}
              onChange={(e) =>
                setDraft((previous) => ({
                  ...previous,
                  sections: previous.sections.map((item) =>
                    item.id === section.id
                      ? { ...item, name: e.target.value }
                      : item,
                  ),
                }))
              }
            />
          </label>
          <ul className="space-y-3">
            {categories
              .filter((row) => row.sectionId === section.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((row) => (
                <li
                  key={row.id}
                  className={row.parentId ? 'border-l-2 border-muted pl-4' : ''}
                >
                  <div className="grid items-end gap-3 sm:grid-cols-3">
                    <label>
                      Category name
                      <input
                        className={fieldClass}
                        required
                        minLength={2}
                        maxLength={100}
                        value={row.name}
                        onChange={(e) =>
                          patch(row.id, { name: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Parent category
                      <select
                        className={fieldClass}
                        value={row.parentId || ''}
                        onChange={(e) =>
                          patch(row.id, { parentId: e.target.value || null })
                        }
                      >
                        <option value="">Top level</option>
                        {!categories.some(
                          (child) => child.parentId === row.id,
                        ) &&
                          categories
                            .filter(
                              (parent) =>
                                parent.sectionId === section.id &&
                                parent.id !== row.id &&
                                !parent.parentId,
                            )
                            .map((parent) => (
                              <option key={parent.id} value={parent.id}>
                                {parent.name}
                              </option>
                            ))}
                      </select>
                    </label>
                    <div className="flex gap-2">
                      <button
                        className={buttonClass}
                        type="button"
                        onClick={() => move(row.id, -1)}
                        aria-label={`Move ${row.name} up`}
                      >
                        Up
                      </button>
                      <button
                        className={buttonClass}
                        type="button"
                        onClick={() => move(row.id, 1)}
                        aria-label={`Move ${row.name} down`}
                      >
                        Down
                      </button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
          <button
            type="button"
            className={buttonClass}
            disabled={
              categories.filter((row) => row.sectionId === section.id).length >=
              30
            }
            onClick={() =>
              setDraft((previous) => ({
                ...previous,
                categories: [
                  ...(previous.categories || []),
                  {
                    id: crypto.randomUUID(),
                    sectionId: section.id,
                    parentId: null,
                    name: 'New category',
                    sortOrder: categories.length,
                  },
                ],
              }))
            }
          >
            Add category to {section.name}
          </button>
          <MenuServingPlacements
            section={section}
            menu={draft}
            servings={servings}
            recipes={recipes}
            onChange={(next) =>
              setDraft((previous) => ({
                ...previous,
                sections: previous.sections.map((row) =>
                  row.id === section.id ? next : row,
                ),
              }))
            }
          />
        </section>
      ))}
      <button
        type="button"
        className={buttonClass}
        disabled={draft.sections.length >= 30}
        onClick={() =>
          setDraft((previous) => ({
            ...previous,
            sections: [
              ...previous.sections,
              { id: crypto.randomUUID(), name: 'New section', items: [] },
            ],
          }))
        }
      >
        Add menu section
      </button>
      <button className={buttonClass} disabled={busy}>
        Save menu categories
      </button>
    </form>
  );
}
