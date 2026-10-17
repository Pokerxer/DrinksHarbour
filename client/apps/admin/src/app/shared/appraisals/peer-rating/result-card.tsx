import type { PeerResult } from '@/services/peerAppraisal.service';
export const formatMoney = (minor: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(
    minor / 100
  );
export default function ResultCard({ result }: { result: PeerResult }) {
  return (
    <section
      className="rounded-2xl border border-gray-200 bg-white p-6"
      aria-label="Your appraisal result"
    >
      <p className="text-sm font-medium text-gray-500">
        Your colleague appraisal
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">
        {result.averageScore.toFixed(2)} / 5
      </p>
      <p className="mt-1 text-sm text-gray-500">
        Based on {result.ratingCount} colleague ratings
      </p>
      <dl className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-sm text-gray-500">Bonus allocation</dt>
          <dd className="mt-1 font-semibold">
            {formatMoney(result.allocationMinor)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Calculated bonus</dt>
          <dd className="mt-1 text-xl font-semibold text-[#b20202]">
            {formatMoney(result.bonusMinor)}
          </dd>
        </div>
      </dl>
      <p className="mt-5 text-xs text-gray-500">
        Bonus = average rating ÷ 5 × allocation. This is your calculated bonus,
        not a payment confirmation.
      </p>
    </section>
  );
}
