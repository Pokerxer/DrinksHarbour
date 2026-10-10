'use client';
import type { PricelistSettings } from './inventory-pricelist-settings';
export default function PricelistDocumentOptions({
  settings: s,
  onChange,
}: {
  settings: PricelistSettings;
  onChange: (settings: PricelistSettings) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold text-gray-700">Document options</h3>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(
          [
            { key: 'title', label: 'Title', type: 'text' },
            {
              key: 'businessName',
              label: 'Business name (optional)',
              type: 'text',
            },
            {
              key: 'validUntil',
              label: 'Valid until (optional)',
              type: 'date',
            },
          ] as const
        ).map((field) => (
          <label key={field.key} className="space-y-1 text-xs text-gray-600">
            <span className="block font-semibold">{field.label}</span>
            <input
              aria-label={field.label}
              type={field.type}
              value={s[field.key]}
              onChange={(e) => onChange({ ...s, [field.key]: e.target.value })}
              className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs"
            />
          </label>
        ))}
        <label className="space-y-1 text-xs text-gray-600">
          <span className="block font-semibold">Trade discount (%)</span>
          <input
            aria-label="Trade discount percent"
            type="number"
            min={0}
            max={90}
            value={s.discountPercent}
            onChange={(e) =>
              onChange({
                ...s,
                discountPercent: Math.max(
                  0,
                  Math.min(90, Number(e.target.value) || 0)
                ),
              })
            }
            className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs"
          />
        </label>
      </div>
      <label className="block space-y-1 text-xs text-gray-600">
        <span className="block font-semibold">Tax note (optional)</span>
        <input
          aria-label="Tax note"
          value={s.taxNote}
          onChange={(e) => onChange({ ...s, taxNote: e.target.value })}
          placeholder="e.g. 7.5% tax included."
          className="h-9 w-full rounded-lg border border-gray-200 px-3 text-xs"
        />
        <span className="block text-[11px] text-gray-500">
          Printed as a note. Prices are calculated from your saved pricelist
          rules; this note does not add tax.
        </span>
      </label>
      <div className="flex flex-wrap gap-3">
        {(
          [
            { key: 'groupByCategory', label: 'Group by category' },
            { key: 'showSku', label: 'Show SKU' },
            { key: 'showAvailability', label: 'Show availability' },
            { key: 'showWasPrices', label: 'Show “was” prices' },
          ] as const
        ).map((field) => (
          <label
            key={field.key}
            className="flex items-center gap-2 text-xs text-gray-600"
          >
            <input
              type="checkbox"
              checked={s[field.key]}
              onChange={(e) =>
                onChange({ ...s, [field.key]: e.target.checked })
              }
              className="accent-[#b20202]"
            />
            {field.label}
          </label>
        ))}
      </div>
      <p className="text-[11px] text-gray-500">
        Trade discount applies to every final unit or bundle price on this
        sheet.
      </p>
    </section>
  );
}
