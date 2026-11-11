import cn from '@core/utils/class-names';

const statuses: Record<string, { label: string; color: string }> = {
  active: { label: 'Active', color: 'border-green-200 bg-green-50 text-green-800' },
  archived: { label: 'Archived', color: 'border-gray-300 bg-gray-100 text-gray-700' },
  discontinued: { label: 'Discontinued', color: 'border-red-200 bg-red-50 text-red-800' },
  draft: { label: 'Draft', color: 'border-blue-200 bg-blue-50 text-blue-800' },
  pending: { label: 'Pending', color: 'border-amber-200 bg-amber-50 text-amber-800' },
  rejected: { label: 'Rejected', color: 'border-red-200 bg-red-50 text-red-800' },
  hidden: { label: 'Hidden', color: 'border-gray-200 bg-gray-50 text-gray-700' },
  low_stock: { label: 'Low Stock', color: 'border-amber-200 bg-amber-50 text-amber-800' },
  out_of_stock: { label: 'Out of Stock', color: 'border-red-200 bg-red-50 text-red-800' },
};

export default function CatalogStatusBadge({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  // Central products use "approved" for the active catalog state.
  const entry = statuses[status === 'approved' ? 'active' : status || 'draft'];
  return (
    <span
      className={cn(
        'inline-flex w-fit items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[10px] font-semibold',
        entry?.color ?? 'border-gray-200 bg-gray-50 text-gray-700',
        className
      )}
    >
      {entry?.label ?? 'Unknown status'}
    </span>
  );
}
