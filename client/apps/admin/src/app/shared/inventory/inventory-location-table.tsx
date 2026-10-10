import Link from 'next/link';
import { PiStar, PiWarehouse, PiStorefront, PiTruck, PiArrowRight } from 'react-icons/pi';
import { routes } from '@/config/routes';
import { fmtNgn } from './inventory-receipts-support';
import { LOCATION_TYPES, locationAddress, type LocationReport } from './inventory-location-report';
export default function LocationTable({
  reports,
  stockAvailable,
}: {
  reports: LocationReport[];
  stockAvailable: boolean;
}) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[940px] text-xs">
        <caption className="sr-only">Stock by inventory location</caption>
        <thead className="border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
          <tr>
            {[
              'Location',
              'Status',
              'Products / Lines',
              'On hand',
              'Reserved',
              'Available',
              'Value at cost',
              'Alerts',
              'Analysis',
            ].map((label, i) => (
              <th key={i} className={`px-4 py-3 ${i < 2 ? 'text-left' : 'text-right'}`} scope="col">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {reports.map(({ warehouse: w, totals }) => {
            const Icon =
              w.type === 'store'
                ? PiStorefront
                : w.type === 'distribution_center'
                  ? PiTruck
                  : PiWarehouse;
            const number = (value: number) => (stockAvailable ? value.toLocaleString() : '—');
            return (
              <tr key={w._id} className="group hover:bg-gray-50">
                <td className="max-w-[300px] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <span className="rounded-lg bg-gray-100 p-2 text-gray-400 group-hover:bg-[#b20202]/5 group-hover:text-[#b20202]">
                      <Icon className="h-4 w-4" />
                    </span>
                    <div>
                      <Link
                        href={routes.warehouses.detail(w._id)}
                        className="font-semibold text-gray-800 hover:text-[#b20202] hover:underline"
                      >
                        {w.name}
                      </Link>
                      {w.isDefault && (
                        <span
                          title="Default location"
                          aria-label="Default location"
                          className="ml-1 inline-block text-amber-500"
                        >
                          <PiStar className="h-3 w-3" />
                        </span>
                      )}
                      <p className="mt-0.5 text-[10px] text-gray-400">
                        {w.code} · {LOCATION_TYPES[w.type] || 'Location'}
                      </p>
                      <p className="mt-0.5 text-[10px] text-gray-400">{locationAddress(w)}</p>
                      {w.contact?.name && (
                        <p className="mt-0.5 text-[10px] text-gray-400">
                          Contact: {w.contact.name}
                        </p>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${w.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-100 text-gray-500'}`}
                  >
                    {w.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">
                  <span className="font-semibold text-gray-900">{number(totals.products)}</span>
                  <p className="mt-0.5 text-[10px] text-gray-400">{number(totals.lines)} lines</p>
                </td>
                {[totals.units, totals.reserved, totals.available].map((value, i) => (
                  <td
                    key={i}
                    className="px-4 py-3 text-right font-semibold tabular-nums text-gray-800"
                  >
                    {number(value)}
                  </td>
                ))}
                <td className="whitespace-nowrap px-4 py-3 text-right font-semibold tabular-nums text-[#b20202]">
                  {stockAvailable ? fmtNgn(totals.value) : 'Unavailable'}
                </td>
                <td
                  className={`px-4 py-3 text-right font-semibold tabular-nums ${totals.alerts ? 'text-amber-600' : 'text-gray-400'}`}
                >
                  {number(totals.alerts)}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={routes.warehouses.locationAnalysis(w._id)}
                    className="flex items-center justify-end gap-1 whitespace-nowrap text-[11px] font-semibold text-[#b20202] hover:underline"
                  >
                    Stock & history
                    <PiArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
