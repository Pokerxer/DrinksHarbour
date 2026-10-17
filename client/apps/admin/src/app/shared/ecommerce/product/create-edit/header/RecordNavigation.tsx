'use client';
import { PiArrowLeft, PiArrowRight } from 'react-icons/pi';
export default function RecordNavigation({
  index,
  total,
  busy,
  onPrevious,
  onNext,
}: {
  index: number;
  total: number;
  busy: boolean;
  onPrevious: () => void;
  onNext: () => void;
}) {
  if (total < 1 || index < 0 || index >= total) return null;
  const button =
    'flex h-11 w-11 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <nav
      aria-label="Product navigation"
      className="flex shrink-0 items-center rounded-xl border border-gray-200 bg-white p-0.5"
    >
      <button
        type="button"
        aria-label="Previous product"
        disabled={busy || index === 0}
        onClick={onPrevious}
        className={button}
      >
        <PiArrowLeft size={18} aria-hidden />
      </button>
      <span
        aria-label="Product position"
        className="min-w-16 px-2 text-center text-sm font-semibold tabular-nums text-gray-700"
      >
        {index + 1} of {total}
      </span>
      <button
        type="button"
        aria-label="Next product"
        disabled={busy || index === total - 1}
        onClick={onNext}
        className={button}
      >
        <PiArrowRight size={18} aria-hidden />
      </button>
    </nav>
  );
}
