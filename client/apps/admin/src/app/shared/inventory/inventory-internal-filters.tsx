export default function InternalRouteFilters({
  warehouses,
  fromWarehouse,
  toWarehouse,
  setFromWarehouse,
  setToWarehouse,
}: {
  warehouses: { id: string; label: string }[];
  fromWarehouse: string;
  toWarehouse: string;
  setFromWarehouse: (value: string) => void;
  setToWarehouse: (value: string) => void;
}) {
  return (
    <>
      {[
        {
          label: 'From warehouse',
          value: fromWarehouse,
          change: setFromWarehouse,
          all: 'All origins',
        },
        {
          label: 'To warehouse',
          value: toWarehouse,
          change: setToWarehouse,
          all: 'All destinations',
        },
      ].map(({ label, value, change, all }) => (
        <label
          key={label}
          className="flex flex-col gap-0.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400"
        >
          {label}
          <select
            aria-label={`Filter ${label.toLowerCase()}`}
            value={value}
            onChange={(e) => change(e.target.value)}
            className="h-[34px] rounded-lg border border-gray-200 bg-white px-2.5 text-xs normal-case text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-1 focus:ring-[#b20202]/20"
          >
            <option value="">{all}</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.label}
              </option>
            ))}
          </select>
        </label>
      ))}
    </>
  );
}
