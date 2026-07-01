// client/apps/admin/src/app/shared/sales/sales-stage-pill.tsx

export type CreateTab = 'lines' | 'other';

/** Non-interactive lifecycle-stage indicator — visual parity only, no click behavior. */
export function StagePill({ label, active }: { label: string; active: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-brand/10 text-brand' : 'bg-gray-100 text-gray-400'
      }`}
    >
      {label}
    </span>
  );
}