import { Badge } from 'rizzui';
export interface SubProductItem {
  _id: string;
  sku?: string;
  status: string;
  tenant?: { _id: string; name: string };
  baseSellingPrice?: number;
  currency?: string;
  availableStock?: number;
  totalStock?: number;
  sizes?: Array<{ size: string; stock?: number; basePrice?: number }>;
  createdAt: string;
}

const STATUS_MAP: Record<
  string,
  {
    label: string;
    color: 'success' | 'warning' | 'danger' | 'secondary' | 'primary';
  }
> = {
  active: { label: 'Active', color: 'success' },
  pending: { label: 'Pending', color: 'warning' },
  draft: { label: 'Draft', color: 'secondary' },
  archived: { label: 'Declined', color: 'danger' },
  discontinued: { label: 'Discontinued', color: 'danger' },
  hidden: { label: 'Hidden', color: 'secondary' },
  low_stock: { label: 'Low Stock', color: 'warning' },
  out_of_stock: { label: 'Out of Stock', color: 'danger' },
};

export function StatusBadge({ status }: { status: string }) {
  const info = STATUS_MAP[status] ?? { label: status, color: 'secondary' };
  return (
    <Badge
      color={info.color}
      variant="flat"
      className="text-xs font-semibold capitalize"
    >
      {info.label}
    </Badge>
  );
}

export function RowSkeleton() {
  return (
    <div className="flex animate-pulse items-center gap-4 border-b border-gray-100 px-6 py-4 last:border-0">
      <div className="h-10 w-10 flex-shrink-0 rounded-xl bg-gray-200" />
      <div className="flex-1 space-y-2">
        <div className="h-4 w-1/3 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
      </div>
      <div className="flex gap-2">
        <div className="h-8 w-20 rounded-lg bg-gray-200" />
        <div className="h-8 w-20 rounded-lg bg-gray-100" />
      </div>
    </div>
  );
}
