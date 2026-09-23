import { PiCaretLeft, PiCaretRight } from 'react-icons/pi';

export interface ToolbarNavigationProps {
  index: number;
  count: number;
  context: string;
  disabled: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export default function ToolbarNavigation(props: ToolbarNavigationProps) {
  if (props.count < 2 || props.index < 0 || props.index >= props.count)
    return null;
  const buttonClass =
    'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-30';
  return (
    <nav
      aria-label="Product records"
      className="flex shrink-0 items-center gap-1"
    >
      {props.context && (
        <span
          title={props.context}
          className="hidden max-w-40 truncate text-xs text-gray-500 xl:block"
        >
          {props.context}
        </span>
      )}
      <button
        type="button"
        aria-label="Previous product"
        className={buttonClass}
        disabled={props.disabled || props.index === 0}
        onClick={props.onPrevious}
      >
        <PiCaretLeft aria-hidden="true" className="h-4 w-4" />
      </button>
      <span
        aria-live="polite"
        className="whitespace-nowrap text-xs font-medium tabular-nums text-gray-600"
      >
        {props.index + 1} / {props.count}
      </span>
      <button
        type="button"
        aria-label="Next product"
        className={buttonClass}
        disabled={props.disabled || props.index === props.count - 1}
        onClick={props.onNext}
      >
        <PiCaretRight aria-hidden="true" className="h-4 w-4" />
      </button>
    </nav>
  );
}
