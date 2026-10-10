import type { useAdjustmentEntry } from './use-adjustment-entry';
export default function AdjustmentCountPreview({
  v,
}: {
  v: ReturnType<typeof useAdjustmentEntry>;
}) {
  return (
    <>
      {v.product && v.size && (
        <div
          className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm"
          aria-live="polite"
        >
          <p>
            On hand: <strong>{v.current}</strong> · Reserved: <strong>{v.reserved}</strong>
          </p>
          <p className="mt-1">
            After adjustment:{' '}
            <strong>{v.quantity && !v.preview.error ? v.preview.target : '—'}</strong>
            {v.quantity && !v.preview.error && (
              <span className="ml-2 text-[#b20202]">
                ({v.preview.delta > 0 ? '+' : ''}
                {v.preview.delta})
              </span>
            )}
          </p>
          {v.quantity && v.preview.error && (
            <p className="mt-1 text-xs text-red-600">{v.preview.error}</p>
          )}
        </div>
      )}
    </>
  );
}
