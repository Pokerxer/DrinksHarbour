'use client';
import { useEffect, useState } from 'react';
import { getBill, setLines, venueRequest } from '@/services/venue/api';
import {
  combineVenueQuantities,
  editableVenueLines,
} from '@/services/venue/checkout-lines';
import type { VenueBill } from '@/services/venue/types';
import {
  buttonClass,
  fieldClass,
  Notice,
  panelClass,
} from './workspace/controls';
type Option = {
  id: string;
  label: string;
  type: 'addon' | 'instruction';
  unitPriceMinor: number;
  defaultQuantity?: number;
};
type Group = {
  id: string;
  name: string;
  minSelect: number;
  maxSelect: number;
  options: Option[];
};
type Serving = {
  subProductId: string;
  sizeId: string;
  name: string;
  sizeLabel: string;
  unitPriceMinor: number;
  available: boolean;
  servingSnapshot: { servingVersion: number };
  modifierGroups?: Group[];
};
type Menu = {
  schemaVersion?: 2;
  sections: { id: string; name: string; items: Serving[] }[];
};
export default function VenueServingOrder({
  token,
  sessionId,
  onChanged,
}: {
  token: string;
  sessionId: string;
  onChanged: () => void;
}) {
  const [bill, setBill] = useState<VenueBill | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [selected, setSelected] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [choices, setChoices] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const choose = (item: Serving) => {
    setSelected(item.sizeId);
    setChoices(
      Object.fromEntries(
        (item.modifierGroups || []).flatMap((group) =>
          group.options.map((option) => [
            `${group.id}:${option.id}`,
            option.defaultQuantity || 0,
          ]),
        ),
      ),
    );
  };
  useEffect(() => {
    let active = true;
    getBill(token, sessionId)
      .then(async (current) => {
        if (!active) return;
        setBill(current);
        if (current.state !== 'open' || !current.locationId) return;
        const result = await venueRequest<Menu>(
          token,
          `/locations/${current.locationId}/menu`,
        );
        if (active) {
          setMenu(result);
          const item = result.sections.flatMap((section) => section.items)[0];
          if (item) choose(item);
        }
      })
      .catch((e) => {
        if (active)
          setError(e instanceof Error ? e.message : 'Unable to load servings');
      });
    return () => {
      active = false;
    };
  }, [token, sessionId]);
  if (menu?.schemaVersion !== 2)
    return error ? (
      <Notice tone="error" role="alert">
        {error}
      </Notice>
    ) : null;
  const items = menu.sections.flatMap((section) => section.items);
  const item = items.find((row) => row.sizeId === selected);
  const groups = item?.modifierGroups || [];
  const valid = groups.every((group) => {
    const count = group.options.reduce(
      (sum, option) => sum + (choices[`${group.id}:${option.id}`] || 0),
      0,
    );
    return count >= group.minSelect && count <= group.maxSelect;
  });
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update this visit');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className={`${panelClass} space-y-4`}>
      <h3 className="text-lg font-semibold">Order a serving</h3>
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
      {bill?.state === 'open' && (
        <>
          <label className="block">
            Serving
            <select
              className={fieldClass}
              value={selected}
              onChange={(e) => {
                const next = items.find((row) => row.sizeId === e.target.value);
                if (next) choose(next);
              }}
            >
              {items.map((row) => (
                <option key={row.sizeId} value={row.sizeId}>
                  {row.name} · {row.sizeLabel}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            Portions
            <input
              className={fieldClass}
              type="number"
              min="1"
              max="100"
              step="1"
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
            />
          </label>
          {groups.map((group) => (
            <fieldset className="space-y-2" key={group.id}>
              <legend>
                {group.name} · choose {group.minSelect}–{group.maxSelect}
              </legend>
              {group.options.map((option) => (
                <label className="block" key={option.id}>
                  {option.label} quantity
                  <span className="ml-2 text-xs">
                    {option.type === 'instruction'
                      ? 'Preparation instruction'
                      : new Intl.NumberFormat('en-NG', {
                          style: 'currency',
                          currency: 'NGN',
                        }).format(option.unitPriceMinor / 100)}
                  </span>
                  <input
                    aria-label={`${option.label} quantity`}
                    className={fieldClass}
                    type="number"
                    min="0"
                    max="10"
                    step="1"
                    value={choices[`${group.id}:${option.id}`] || 0}
                    onChange={(e) =>
                      setChoices((previous) => ({
                        ...previous,
                        [`${group.id}:${option.id}`]: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              ))}
            </fieldset>
          ))}
          <button
            className={buttonClass}
            disabled={
              busy ||
              !item?.available ||
              !valid ||
              !Number.isInteger(quantity) ||
              quantity < 1 ||
              quantity > 100
            }
            onClick={() =>
              void run(async () => {
                if (!bill || !item) return;
                const selectedChoices = groups.flatMap((group) =>
                  group.options.flatMap((option) => {
                    const count = choices[`${group.id}:${option.id}`] || 0;
                    return count
                      ? [
                          {
                            groupId: group.id,
                            optionId: option.id,
                            quantity: count,
                          },
                        ]
                      : [];
                  }),
                );
                const lines = combineVenueQuantities([
                  ...editableVenueLines(bill.lines),
                  {
                    subProductId: item.subProductId,
                    sizeId: item.sizeId,
                    servingVersion: item.servingSnapshot.servingVersion,
                    quantity,
                    ...(selectedChoices.length
                      ? { choices: selectedChoices }
                      : {}),
                  },
                ]);
                const saved = await setLines(token, sessionId, {
                  expectedVersion: bill.version,
                  lines,
                });
                setBill({ ...bill, ...saved });
                setMessage(
                  'Serving added. Send new items to preparation before billing.',
                );
              })
            }
          >
            Add serving to visit
          </button>
          <button
            className={buttonClass}
            disabled={busy || !bill.lines.length}
            onClick={() =>
              void run(async () => {
                const result = await venueRequest<VenueBill>(
                  token,
                  `/service-sessions/${sessionId}/fire`,
                  'POST',
                  { expectedVersion: bill.version },
                );
                setBill({ ...bill, ...result });
                setMessage('New items sent to preparation.');
              })
            }
          >
            Send new items to preparation
          </button>
        </>
      )}
    </section>
  );
}
