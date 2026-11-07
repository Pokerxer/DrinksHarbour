import type {
  DeliveryConfiguration,
  ReviewedContract,
} from '@/services/delivery-settings.service';
import { buttonClass } from '../market-foundation/workspace';
export default function ContractHistory({
  data,
  busy,
  page,
  onPage,
  onRevoke,
}: {
  data: DeliveryConfiguration;
  busy: boolean;
  page: number;
  onPage: (page: number) => void;
  onRevoke: (contract: ReviewedContract) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Reviewed terms history</h2>
      {!data.contracts.length && <p>No reviews have been recorded.</p>}
      {data.contracts.map((row) => (
        <article key={row._id} className="rounded border p-4">
          <h3 className="font-semibold">
            Version {row.version} —{' '}
            {row._id === data.latest?._id
              ? `Current: ${data.state}`
              : `Superseded: ${row.status}`}
          </h3>
          <p>
            NGN {(row.amountMinor / 100).toFixed(2)} · {row.maxUnits} units ·{' '}
            {row.maxWeightGrams} grams · {row.vehicleTypes.join(', ')}
          </p>
          {row.coverage.map((r, i) => (
            <p key={i}>
              {r.city}, {r.state}, {r.country} — latitude {r.minLat} to{' '}
              {r.maxLat}; longitude {r.minLon} to {r.maxLon}
            </p>
          ))}
          <p>
            Alcohol: {row.capabilities.alcohol ? 'supported' : 'not supported'}{' '}
            · Age verification:{' '}
            {row.capabilities.ageVerification ? 'supported' : 'not supported'} ·
            Fragile: {row.capabilities.fragile ? 'supported' : 'not supported'}
          </p>
          <p>Evidence: {row.reviewReference}</p>
          <p>
            Reviewed {row.reviewedAt} · Expires {row.validUntil}
            {row.revokedAt && ` · Revoked ${row.revokedAt}`}
          </p>
          {row.status !== 'revoked' && (
            <button
              className={buttonClass}
              disabled={busy}
              onClick={() => onRevoke(row)}
            >
              Revoke version {row.version}
            </button>
          )}
        </article>
      ))}
      <div className="flex gap-3">
        <button
          className={buttonClass}
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous reviews
        </button>
        <span>
          Page {page} of {data.pagination.pages || 1}
        </span>
        <button
          className={buttonClass}
          disabled={busy || page >= data.pagination.pages}
          onClick={() => onPage(page + 1)}
        >
          Next reviews
        </button>
      </div>
    </section>
  );
}
