'use client';
import SalesEditorSelect from './sales-editor-select';

export default function SalesPricelistSelect({
  pricelists,
  value,
  onChange,
  loading = false,
  error,
  onRetry,
  resolvedId,
}: {
  pricelists: { _id: string; name: string }[];
  value: string;
  onChange: (id: string) => void;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  resolvedId?: string | null;
}) {
  const options = [
    ...(loading
      ? [{ value: '__loading__', label: 'Loading pricelists…', disabled: true }]
      : []),
    { value: '', label: '— Base price —', disabled: loading || !!error },
    ...pricelists.map((p) => ({
      value: p._id,
      label: p.name,
      badge: p._id === resolvedId ? 'Auto-applied' : undefined,
      disabled: loading || !!error,
    })),
  ];
  return (
    <div>
      <SalesEditorSelect
        label="Pricelist"
        options={options}
        value={value}
        onChange={onChange}
        searchable
        searchPlaceholder="Search pricelists…"
      />
      {loading && (
        <p role="status" className="mt-1.5 text-xs text-gray-500">
          Loading pricelists…
        </p>
      )}
      {error && (
        <div role="alert" className="mt-1.5 text-xs text-red-700">
          {error}{' '}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold underline"
            >
              Retry pricelists
            </button>
          )}
        </div>
      )}
    </div>
  );
}
