'use client';
export default function NotificationSelection({
  unread,
  selected,
  selectedUnread,
  busy,
  loading,
  busyLabel,
  allChecked,
  toggleAll,
  clear,
  mark,
}: {
  unread: number;
  selected: number;
  selectedUnread: number;
  busy: boolean;
  loading: boolean;
  busyLabel: string;
  allChecked: boolean | 'mixed';
  toggleAll: () => void;
  clear: () => void;
  mark: () => void;
}) {
  return (
    <div className="flex min-h-14 flex-wrap items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-4 py-2">
      <label className="flex min-h-10 cursor-pointer items-center gap-2 text-xs font-semibold text-gray-600">
        <input
          type="checkbox"
          aria-label="Select unread notices"
          aria-checked={allChecked}
          checked={allChecked === true}
          ref={(node) => {
            if (node) node.indeterminate = allChecked === 'mixed';
          }}
          onChange={toggleAll}
          disabled={!unread || busy || loading}
          className="h-4 w-4 rounded border-gray-300 accent-[#b20202]"
        />
        Select unread notices
      </label>
      <span className="text-xs text-gray-500" aria-live="polite">
        {selected
          ? `${selected} selected · ${selectedUnread} unread`
          : `${unread} unread in this view`}
      </span>
      {selected > 0 && (
        <>
          <button
            onClick={clear}
            disabled={busy}
            className="min-h-10 px-2 text-xs font-semibold text-gray-600 hover:text-gray-900 disabled:opacity-40"
          >
            Clear selection
          </button>
          <button
            onClick={mark}
            disabled={busy || loading || !selectedUnread}
            className="ml-auto min-h-10 rounded-xl bg-[#b20202] px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-[#8f0101] disabled:opacity-40"
          >
            {busy ? busyLabel : `Mark selected (${selected})`}
          </button>
        </>
      )}
    </div>
  );
}
