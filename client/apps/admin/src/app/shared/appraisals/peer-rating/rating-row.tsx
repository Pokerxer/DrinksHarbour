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
      className="min-w-0 rounded-xl border border-gray-200 p-4"
    >
      <legend className="max-w-full break-words px-1 text-sm font-semibold">
        {colleague.displayName}
      </legend>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <label
            key={n}
            className={`flex h-11 min-w-0 cursor-pointer items-center justify-center rounded-lg border ${value === n ? 'border-[#b20202] bg-[#b20202] font-semibold text-white' : 'border-gray-200 bg-white text-gray-600 hover:border-red-200 hover:bg-red-50'}`}
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
      <div className="mt-2 flex justify-between text-[11px] text-gray-400">
        <span>Lowest</span>
        <span>Highest</span>
      </div>
    </fieldset>
  );
}
