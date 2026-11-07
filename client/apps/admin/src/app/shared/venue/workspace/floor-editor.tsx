'use client';
import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import type { Floor, Workspace } from '@/services/venue/experience';
import {
  fieldClass,
  hintClass,
  panelClass,
  primaryButtonClass,
  buttonClass,
  UnsavedHint,
} from './controls';

export default function FloorEditor({
  value,
  tables,
  onSave,
  busy,
}: {
  value: Floor;
  tables: Workspace['tables'];
  onSave: (floor: Floor) => Promise<void>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => window.removeEventListener('beforeunload', beforeUnload);
  }, [dirty]);
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
        This layout changes table presentation. Seat and checkout actions use
        the live visit controls.
      </p>
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">Zones</legend>
        <p className={hintClass}>
          Zones group tables for staff, e.g. Main floor, Terrace, VIP.
        </p>
        {draft.zones.map((zone, index) => (
          <label className="block max-w-sm text-sm font-medium" key={zone.id}>
            Zone {index + 1}
            <input
              required
              value={zone.name}
              onChange={(e) => {
                setDirty(true);
                setDraft({
                  ...draft,
                  zones: draft.zones.map((v, i) =>
                    i === index ? { ...v, name: e.target.value } : v,
                  ),
                });
              }}
              className={fieldClass}
            />
          </label>
        ))}
        <button
          type="button"
          className={buttonClass}
          onClick={() => {
            setDirty(true);
            setDraft({
              ...draft,
              zones: [
                ...draft.zones,
                { id: crypto.randomUUID(), name: 'New zone' },
              ],
            });
          }}
        >
          Add zone
        </button>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-base font-semibold">
          Tables on the floor
        </legend>
        <div className="overflow-x-auto rounded-xl border border-muted dark:border-gray-700">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Accessible floor list · live table status
            </caption>
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                {['Table', 'Status', 'Zone', 'Position', 'Shape'].map((h) => (
                  <th
                    scope="col"
                    key={h}
                    className="p-3 font-semibold text-gray-700 dark:text-gray-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const position = draft.tables.find(
                  (t) => t.tableId === table._id,
                );
                const patch = (changes: Partial<Floor['tables'][number]>) => {
                  setDirty(true);
                  setDraft({
                    ...draft,
                    tables: position
                      ? draft.tables.map((t) =>
                          t.tableId === table._id ? { ...t, ...changes } : t,
                        )
                      : [
                          ...draft.tables,
                          {
                            tableId: table._id,
                            zone: draft.zones[0]?.id || '',
                            x: 10,
                            y: 10,
                            shape: 'square',
                            ...changes,
                          },
                        ],
                  });
                };
                return (
                  <tr
                    key={table._id}
                    className="border-t border-muted dark:border-gray-700"
                  >
                    <td className="p-3 font-medium">
                      {table.name} ·{' '}
                      <span className="tabular-nums">{table.seats} seats</span>
                    </td>
                    <td className="p-3">{table.status}</td>
                    <td className="p-3">
                      <select
                        aria-label={`Zone for ${table.name}`}
                        className={`${fieldClass} w-auto`}
                        value={position?.zone || ''}
                        onChange={(e) => patch({ zone: e.target.value })}
                      >
                        <option value="">Unmapped</option>
                        {draft.zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-3">
                      {(['x', 'y'] as const).map((key) => (
                        <label
                          key={key}
                          className="mr-3 inline-flex items-center gap-1 text-xs font-medium uppercase"
                        >
                          {key} position
                          <input
                            aria-label={`${key === 'x' ? 'Horizontal' : 'Vertical'} position for ${table.name}`}
                            className={`${fieldClass} w-20`}
                            type="number"
                            min={0}
                            max={100}
                            value={position?.[key] ?? 10}
                            onChange={(e) =>
                              patch({ [key]: Number(e.target.value) })
                            }
                          />
                        </label>
                      ))}
                    </td>
                    <td className="p-3">
                      <select
                        aria-label={`Shape for ${table.name}`}
                        className={`${fieldClass} w-auto`}
                        value={position?.shape || 'square'}
                        onChange={(e) => patch({ shape: e.target.value })}
                      >
                        {['square', 'round', 'rectangle'].map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </fieldset>
      <p className={hintClass}>
        Positions are percentages of the floor canvas (0–100 from top left).
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <button
          disabled={busy}
          className={primaryButtonClass}
        >
          <Save aria-hidden="true" className="size-4" />
          Save floor layout
        </button>
        <UnsavedHint dirty={dirty} />
      </div>
    </form>
  );
}
