import { PiBuildings, PiStack, PiCube, PiCurrencyNgn, PiWarningCircle } from 'react-icons/pi';
import { fmtNgn } from './inventory-receipts-support';
import type { LocationReport } from './inventory-location-report';
export default function LocationSummary({
  reports,
  loading,
  unavailable,
  locationUnavailable = false,
}: {
  reports: LocationReport[];
  loading: boolean;
  unavailable: boolean;
  locationUnavailable?: boolean;
}) {
  const total = reports.reduce(
    (sum, r) => ({
      units: sum.units + r.totals.units,
      reserved: sum.reserved + r.totals.reserved,
      available: sum.available + r.totals.available,
      value: sum.value + r.totals.value,
      lines: sum.lines + r.totals.lines,
      alerts: sum.alerts + r.totals.alerts,
    }),
    { units: 0, reserved: 0, available: 0, value: 0, lines: 0, alerts: 0 },
  );
  return (
    <section
      aria-label="Visible location totals"
      className="flex shrink-0 items-stretch gap-px overflow-x-auto border-b border-gray-200 bg-gray-100 sm:grid sm:grid-cols-3 lg:grid-cols-5"
    >
      {[
        {
          label: 'Locations shown',
          value: String(reports.length),
          icon: PiBuildings,
          color: 'text-blue-600',
          sub: 'current view',
          location: true,
        },
        {
          label: 'Stock lines',
          value: total.lines.toLocaleString(),
          icon: PiCube,
          color: 'text-blue-600',
          sub: 'product and size lines',
        },
        {
          label: 'Units on hand',
          value: total.units.toLocaleString(),
          icon: PiStack,
          color: 'text-emerald-600',
          sub: `${total.reserved.toLocaleString()} reserved · ${total.available.toLocaleString()} available`,
        },
        {
          label: 'Stock value',
          value: fmtNgn(total.value),
          icon: PiCurrencyNgn,
          color: 'text-[#b20202]',
          sub: 'at cost basis',
        },
        {
          label: 'Alerts',
          value: total.alerts.toLocaleString(),
          icon: PiWarningCircle,
          color: 'text-amber-500',
          sub: 'low / out / near expiry',
        },
      ].map(({ label, value, icon: Icon, color, sub, location }) => (
        <div
          key={label}
          className="flex min-w-[168px] shrink-0 items-start gap-3 bg-white px-4 py-3 sm:min-w-0"
        >
          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${color}`} />
          <div className="min-w-0">
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-gray-400">
              {label}
            </p>
            <p className="mt-0.5 text-sm font-bold tabular-nums text-gray-900">
              {loading
                ? 'Loading…'
                : unavailable && (!location || locationUnavailable)
                  ? '—'
                  : value}
            </p>
            <p className="mt-0.5 truncate text-[10px] text-gray-400">
              {loading || unavailable ? '' : sub}
            </p>
          </div>
        </div>
      ))}
    </section>
  );
}
