'use client';
import { useEffect, useState } from 'react';
import { ArrowDownAZ, Plus, Save } from 'lucide-react';
import type { Candidate, MenuItem, Menu } from '@/services/venue/experience';
import {
  buttonClass,
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  UnsavedHint,
} from './controls';
import MenuItemCard from './menu-item-card';

export default function MenuEditor({
  value,
  catalog,
  onMore,
  more,
  busy,
  onSave,
}: {
  value: Menu;
  catalog: Candidate[];
  onMore: () => void;
  more: boolean;
  busy: boolean;
  onSave: (menu: Menu) => Promise<void>;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  const [product, setProduct] = useState('');
  const [size, setSize] = useState('');
  const selected = catalog.find((p) => p.id === product);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
  const patch = (index: number, section: Menu['sections'][number]) => {
    setDirty(true);
    setDraft({
      ...draft,
      sections: draft.sections.map((v, i) => (i === index ? section : v)),
    });
  };
  const patchItem = (
    index: number,
    section: Menu['sections'][number],
    i: number,
    changes: Partial<MenuItem>,
  ) => {
    patch(index, {
      ...section,
      items: section.items.map((v, n) =>
        n === i ? { ...v, ...changes } : v,
      ),
    });
  };
  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setDirty(false);
        void onSave(draft);
      }}
    >
      <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
        Prices come from the selected beverage and serving size. Availability
        follows current location stock. This menu does not add items to retail
        checkout.
      </p>
      <fieldset className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
        <legend className="px-1 text-base font-semibold">
          Build the next addition
        </legend>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Choose a beverage from the approved central catalog, pick its serving
          size, then add it to a menu section below.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-medium">
            Beverage
            <select
              value={product}
              onChange={(e) => {
                setDirty(true);
                setProduct(e.target.value);
                setSize('');
              }}
              className={`${fieldClass} w-auto`}
            >
              <option value="">Choose beverage</option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-medium">
            Serving size
            <select
              value={size}
              onChange={(e) => {
                setDirty(true);
                setSize(e.target.value);
              }}
              className={`${fieldClass} w-auto`}
              disabled={!product}
            >
              <option value="">Choose size</option>
              {selected?.sizes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {!product && (
            <p className={hintClass}>
              Pick a beverage first to see its sizes.
            </p>
          )}
          {!catalog.length && !more && (
            <p className={hintClass}>
              No approved beverages are available in the shared catalog yet.
              Saved menu sections remain editable below.
            </p>
          )}
          {more && (
            <button type="button" onClick={onMore} className={buttonClass}>
              <ArrowDownAZ aria-hidden="true" className="size-4" />
              Load more beverages
            </button>
          )}
        </div>
      </fieldset>
      {draft.sections.map((section, index) => (
        <fieldset
          key={section.id}
          className={`${panelClass} space-y-3`}
        >
          <legend className="px-1 text-base font-semibold">
            Section {index + 1}
          </legend>
          <label className="block max-w-sm text-sm font-medium">
            Section name
            <input
              required
              value={section.name}
              onChange={(e) =>
                patch(index, { ...section, name: e.target.value })
              }
              className={fieldClass}
            />
            <span className={hintClass}>
              For example: Spirits by the glass · Beers · Wine.
            </span>
          </label>
          {section.items.map((item, i) => (
            <MenuItemCard
              key={`${item.subProductId}:${item.sizeId}`}
              item={item}
              candidate={catalog.find((p) => p.id === item.subProductId)}
              itemNumber={i + 1}
              canMoveUp={i > 0}
              onChange={(changes) => patchItem(index, section, i, changes)}
              onRemove={() => {
                setDirty(true);
                setDraft({
                  ...draft,
                  sections: draft.sections.map((v, n) =>
                    n === index
                      ? {
                          ...section,
                          items: section.items.filter((_, m) => m !== i),
                        }
                      : v,
                  ),
                });
              }}
              onMoveUp={() => {
                const items = [...section.items];
                [items[i - 1], items[i]] = [items[i], items[i - 1]];
                patch(index, { ...section, items });
              }}
            />
          ))}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className={buttonClass}
              disabled={
                !product ||
                !size ||
                section.items.some(
                  (i) => i.subProductId === product && i.sizeId === size,
                )
              }
              onClick={() =>
                patch(index, {
                  ...section,
                  items: [
                    ...section.items,
                    { subProductId: product, sizeId: size, published: false },
                  ],
                })
              }
            >
              <Plus aria-hidden="true" className="size-4" />
              Add chosen beverage to {section.name || 'section'}
            </button>
            <button
              type="button"
              className={buttonClass}
              disabled={index === 0}
              onClick={() => {
                const sections = [...draft.sections];
                [sections[index - 1], sections[index]] = [
                  sections[index],
                  sections[index - 1],
                ];
                setDraft({ ...draft, sections });
              }}
            >
              Move section up
            </button>
          </div>
        </fieldset>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setDirty(true);
            setDraft({
              sections: [
                ...draft.sections,
                { id: crypto.randomUUID(), name: '', items: [] },
              ],
            });
          }}
        >
          Add menu section
        </button>
        <button
          disabled={busy}
          className={primaryButtonClass}
        >
          <Save aria-hidden="true" className="size-4" />
          Save beverage menu
        </button>
        <UnsavedHint dirty={dirty} />
      </div>
    </form>
  );
}
