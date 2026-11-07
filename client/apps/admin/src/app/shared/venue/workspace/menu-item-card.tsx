'use client';
import { ChevronUp, X } from 'lucide-react';
import type { Candidate, MenuItem } from '@/services/venue/experience';
import { buttonClass, fieldClass, hintClass } from './controls';
import MenuModifierEditor from './menu-modifier-editor';

/**
 * One menu item card inside a menu section.
 *
 * Optional S1 fields (display/category) are plain controlled inputs; blank
 * values are handed back as undefined so untouched items keep the legacy
 * payload shape. Modifier groups render read-only via MenuModifierEditor —
 * extras are priced at order time through their SubProduct/Size, never here.
 */
export default function MenuItemCard({
  item,
  candidate,
  itemNumber,
  canMoveUp,
  onChange,
  onRemove,
  onMoveUp,
}: {
  item: MenuItem;
  candidate: Candidate | undefined;
  itemNumber: number;
  canMoveUp: boolean;
  onChange: (changes: Partial<MenuItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
}) {
  return (
    <div className="space-y-2 rounded-lg border border-muted bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800/60">
      <div className="flex flex-wrap items-center gap-3">
        <span className="min-w-0 flex-1 text-sm font-medium">
          {candidate?.name || 'Saved beverage'} ·{' '}
          {candidate?.sizes.find((s) => s.id === item.sizeId)?.name ||
            'Saved size'}
        </span>
        <label className="inline-flex min-h-11 items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            className="size-4 rounded border-gray-400"
            checked={item.published}
            onChange={(e) => onChange({ published: e.target.checked })}
          />{' '}
          Published
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Display name
          <input
            maxLength={120}
            value={item.display || ''}
            onChange={(e) =>
              onChange({
                display: e.target.value === '' ? undefined : e.target.value,
              })
            }
            className={fieldClass}
          />
          <span className={hintClass}>
            Optional guest-facing name shown instead of the catalog name.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Category
          <input
            maxLength={100}
            value={item.category || ''}
            onChange={(e) =>
              onChange({
                category: e.target.value === '' ? undefined : e.target.value,
              })
            }
            className={fieldClass}
          />
          <span className={hintClass}>
            Optional backstage label, e.g. starters or mains.
          </span>
        </label>
      </div>
      <MenuModifierEditor groups={item.modifierGroups} />
      {item.pourMl != null && (
        <p className={hintClass}>
          Pours {item.pourMl} ml per serving from opened bottles (read-only;
          pour serving is configured at fire time).
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass} onClick={onRemove}>
          <X aria-hidden="true" className="size-4" />
          Remove item {itemNumber}
        </button>
        <button
          type="button"
          className={buttonClass}
          disabled={!canMoveUp}
          onClick={onMoveUp}
        >
          <ChevronUp aria-hidden="true" className="size-4" />
          Move item {itemNumber} up
        </button>
      </div>
    </div>
  );
}
