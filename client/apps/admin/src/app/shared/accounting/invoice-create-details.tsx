export default function InvoiceCreateDetails({
  dueDate,
  onDueDate,
  disabled,
}: {
  dueDate: string;
  onDueDate: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-gray-400">
          Invoice details
        </p>
        <p className="mt-2 text-sm font-medium text-gray-700">
          Invoice date is assigned when issued
        </p>
      </div>
      <label className="grid gap-2 text-xs font-medium text-gray-600">
        Payment due date{' '}
        <span className="text-[11px] font-normal text-gray-400">Optional</span>
        <input
          type="date"
          value={dueDate}
          disabled={disabled}
          onChange={(event) => onDueDate(event.target.value)}
          className="min-h-11 w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-red-100 disabled:opacity-50"
        />
        <span className="text-[11px] font-normal leading-5 text-gray-500">
          The date this invoice becomes due. Leave blank if no date has been
          agreed.
        </span>
      </label>
      <div className="rounded-lg border border-gray-100 bg-gray-50 p-3 text-xs leading-5 text-gray-500">
        Save a draft to return later. Printing a pro forma keeps it as a draft.
      </div>
    </div>
  );
}
