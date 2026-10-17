import type { PeerEmployee } from '@/services/peerAppraisal.service';
export default function RatingRow({
  colleague,
  value,
  disabled,
  onChange,
}: {
  colleague: PeerEmployee;
  value?: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <fieldset
      disabled={disabled}
      className="rounded-xl border border-gray-200 p-4"
    >
      <legend className="px-1 text-sm font-semibold">
        {colleague.displayName}
      </legend>
      <div className="flex gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border ${value === n ? 'border-[#b20202] bg-red-50 text-[#b20202]' : 'border-gray-200'}`}
          >
            <input
              type="radio"
              className="peer sr-only"
              name={`rating-${colleague.employee}`}
              aria-label={`${colleague.displayName}: ${n}`}
              checked={value === n}
              onChange={() => onChange(n)}
            />
            <span className="rounded peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4">
              {n}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
