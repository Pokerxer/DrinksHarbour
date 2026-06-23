'use client';
import { useUomConversions } from '@/hooks/use-uom-conversions';

/**
 * Pack Size field for PO line items with an optional UOM-conversion picker:
 * choosing "Cases → Units (24)" sets the pack size to 24 and the line's UOM
 * to Cases. Falls back to a plain input when no conversions are defined.
 */
export default function PackSizeInput({
  value,
  onApply,
}: {
  value: number;
  onApply: (patch: { packSize: number; uom?: string }) => void;
}) {
  const { conversions } = useUomConversions();

  return (
    <div>
      <label className="mb-1 block text-[10px] font-medium text-gray-500">
        Pack Size
      </label>
      <input
        type="number"
        min="1"
        value={value}
        onChange={(e) => onApply({ packSize: Number(e.target.value) })}
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs focus:border-[#b20202] focus:outline-none"
      />
      {conversions.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            const c = conversions.find((x) => x._id === e.target.value);
            if (c) onApply({ packSize: c.conversionFactor, uom: c.fromUOM });
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
