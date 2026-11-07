'use client';
import type { MenuItemModifierGroup } from '@/services/venue/experience';
import { hintClass } from './controls';

/**
 * Read-mostly modifier group representation for a menu item.
 *
 * S1 scope: groups saved on the server (or by earlier slices) are rendered
 * read-only — group name, required flag, selection bounds and option labels.
 * Editing of individual options is deferred to a later slice; no prices are
 * shown because option extras are priced at order time via their SubProduct/Size.
 */
export default function MenuModifierEditor({
  groups,
}: {
  groups?: MenuItemModifierGroup[];
}) {
  if (!groups?.length) return null;
  return (
    <ul className="space-y-2" aria-label="Modifier groups">
      {groups.map((group) => (
        <li
          key={group.id}
          className="rounded-lg border border-muted bg-white p-2.5 dark:border-gray-700 dark:bg-gray-900"
        >
          <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
            <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {group.name}
            </span>
            <span className="rounded-full border border-gray-300 bg-gray-50 px-2 py-0.5 text-xs dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {group.required
                ? `Required · pick ${group.minSelect}`
                : `Optional · up to ${group.maxSelect}`}
            </span>
          </p>
          <p className={hintClass}>
            Options: {group.options.map((o) => o.label).join(' · ')}
          </p>
          {group.incompatibleWith.length > 0 && (
            <p className={hintClass}>
              Sits out with: {group.incompatibleWith.join(' · ')}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}
