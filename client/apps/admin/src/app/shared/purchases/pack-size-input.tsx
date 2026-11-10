'use client';
import { useRef } from 'react';
import { useUomConversions } from '@/hooks/use-uom-conversions';

/**
 * Pack Size field for PO/transfer line items with an optional UOM-conversion
 * picker: choosing "Cases → Units (24)" sets the pack size to 24 and the
 * line's UOM to Cases. Falls back to a plain input when no conversions are
 * defined.
 *
 * `onCommitDefault` (optional): when the operator edits the pack size and
 * leaves the field (blur or Enter) with an integer ≥ 1, the edited value is
 * committed as the size's new default packaging quantity — once per edit,
 * never per keystroke (typing "24" must not fire two server writes).
 */
export default function PackSizeInput({
  value,
  onApply,
  onCommitDefault,
}: {
  value: number;
  onApply: (patch: { packSize: number; uom?: string }) => void;
  onCommitDefault?: (value: number) => void;
}) {
  const { conversions } = useUomConversions();
  // The pack size as of the moment the field took focus — the blur commit
  // fires only when the operator actually changed it.
  const valueAtFocus = useRef(value);

  function commitIfChanged() {
    if (!onCommitDefault) return;
    const n = Number(value);
    if (Number.isFinite(n) && n >= 1 && Math.floor(n) === n && n !== valueAtFocus.current) {
      valueAtFocus.current = n;
      onCommitDefault(n);
    }
  }

  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-gray-500">
        Pack Size
      </label>
      <input
        type="number"
        min="1"
        step="1"
        value={value}
        onFocus={() => {
          valueAtFocus.current = value;
        }}
        onChange={(e) => onApply({ packSize: Number(e.target.value) })}
        onBlur={commitIfChanged}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitIfChanged();
          }
        }}
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
      />
      {conversions.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const c = conversions.find((x) => x._id === e.target.value);
            if (c) {
              onApply({ packSize: c.conversionFactor, uom: c.fromUOM });
              // A UOM-conversion pick is an explicit pack-size edit — it
              // commits as the size's new default too.
              valueAtFocus.current = value;
              if (onCommitDefault) {
                valueAtFocus.current = c.conversionFactor;
                onCommitDefault(c.conversionFactor);
              }
            }
          }}
          title="Fill pack size from a UOM conversion"
          className="mt-1 w-full rounded-lg border border-dashed border-gray-200 px-2 py-1 text-[10px] text-gray-500 focus:border-[#b20202] focus:outline-none"
        >
          <option value="">Apply UOM…</option>
          {conversions.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name} ({c.conversionFactor})
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
