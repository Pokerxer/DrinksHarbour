import type { Floor, Workspace } from '@/services/venue/experience';
import { Chip } from './controls';

const statusTones: Record<string, 'ready' | 'pending' | 'info' | 'danger'> = {
  available: 'ready',
  occupied: 'danger',
  reserved: 'pending',
};

export default function FloorList({
  floor,
  tables,
}: {
  floor: Floor;
  tables: Workspace['tables'];
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Floor and tables</h2>
      {!!floor.tables.length && (
        <figure className="m-0">
          <figcaption className="text-sm text-gray-600 dark:text-gray-300">
            Layout preview · use the table list and arrival controls below
          </figcaption>
          <div
            aria-hidden="true"
            className="relative my-3 h-80 overflow-hidden rounded-xl border border-muted bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
          >
            {floor.tables.map((position) => {
              const table = tables.find((t) => t._id === position.tableId);
              return (
                <span
                  key={position.tableId}
                  className={`absolute max-w-28 border border-muted bg-white p-2 text-xs shadow-sm ${position.shape === 'round' ? 'rounded-full' : 'rounded-lg'} dark:border-gray-600 dark:bg-gray-900`}
                  style={{
                    left: `${position.x * 0.85}%`,
                    top: `${position.y * 0.85}%`,
                  }}
                >
                  {table?.name} · {table?.status}
                </span>
              );
            })}
          </div>
        </figure>
      )}
      <div className="overflow-x-auto rounded-xl border border-muted dark:border-gray-700">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Live table list</caption>
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              {['Table', 'Zone', 'Seats', 'Status'].map((h) => (
                <th
                  scope="col"
                  className="p-3 font-semibold text-gray-700 dark:text-gray-200"
                  key={h}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tables.map((t) => {
              const position = floor.tables.find((p) => p.tableId === t._id);
              return (
                <tr
                  className="border-t border-muted transition-colors hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800/60"
                  key={t._id}
                >
                  <td className="p-3 font-medium">{t.name}</td>
                  <td className="p-3">
                    {floor.zones.find((z) => z.id === position?.zone)?.name ||
                      'Unmapped'}
                  </td>
                  <td className="p-3 tabular-nums">{t.seats}</td>
                  <td className="p-3">
                    <Chip
                      tone={statusTones[t.status] || 'info'}
                      label={t.status}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!tables.length && (
        <p className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-6 text-sm text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          No tables have been configured at this location.
        </p>
      )}
    </section>
  );
}
