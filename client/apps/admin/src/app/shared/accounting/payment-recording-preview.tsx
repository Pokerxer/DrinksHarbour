import { fmtMoney } from './accounting-helpers';
export default function PaymentRecordingPreview({
  amount,
  allocated,
  name,
  linked,
}: {
  amount: number;
  allocated: number;
  name: string;
  linked: boolean;
}) {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4 text-sm">
      <p className="mb-3 text-xs text-gray-500">
        Recording for {name || 'the selected party'}
        {linked ? '' : ' · no account selected'}
      </p>
      <dl className="space-y-2">
        {[
          ['Recorded amount', amount],
          ['Document allocations', allocated],
          [
            'Unallocated remainder',
            Math.max(0, Math.round((amount - allocated) * 100) / 100),
          ],
        ].map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-gray-500">{label}</dt>
            <dd className="font-medium tabular-nums">
              {fmtMoney(Number(value))}
            </dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-gray-500">
        Unallocated money does not settle an individual document. This records a
        payment already made; it sends no money.
      </p>
    </div>
  );
}
