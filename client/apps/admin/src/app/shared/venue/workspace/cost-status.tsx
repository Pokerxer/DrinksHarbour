import { Chip } from './controls';
export function costMoney(value: number | null | undefined) {
  return value == null
    ? 'Unknown'
    : new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN',
      }).format(value / 100);
}
export default function CostStatus({ status }: { status: string }) {
  const labels: Record<string, string> = {
    verified: 'Source cost recorded',
    estimated: 'Estimated cost',
    mixed: 'Partial cost evidence',
    unknown: 'Cost unknown',
    review_required: 'Cost needs review',
  };
  return (
    <Chip
      tone={
        status === 'verified'
          ? 'ready'
          : status === 'estimated'
            ? 'info'
            : 'pending'
      }
      label={labels[status] || 'Cost needs review'}
    />
  );
}
