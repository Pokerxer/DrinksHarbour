import type { VarianceReport } from '@/services/venue/costing';
import { costMoney } from './cost-status';
import { Notice, panelClass } from './controls';
export default function UsageVarianceTable({
  report,
}: {
  report: VarianceReport;
}) {
  return (
    <div className="space-y-4">
      {report.coverage.reconciliationStatus !== 'complete' && (
        <Notice tone="info">
          Incomplete count coverage. Missing observations or valuation evidence
          prevent a complete usage figure.
        </Notice>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          ['Actual usage', report.totals.actualUsageMinor],
          ['Theoretical usage', report.totals.theoreticalUsageMinor],
          ['Usage variance', report.totals.varianceMinor],
        ].map(([label, amount]) => (
          <div className={panelClass} key={String(label)}>
            <p>{label}</p>
            <p className="mt-2 text-xl tabular-nums">
              {costMoney(amount as number | null)}
            </p>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Variance compares actual count-based usage with frozen serving
        consumption. Logged waste is part of actual usage and is not added
        again.
      </p>
      {report.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Stock reference</th>
                <th className="p-3">Actual</th>
                <th className="p-3">Theoretical</th>
                <th className="p-3">Variance</th>
              </tr>
            </thead>
            <tbody>
              {report.rows.map((row) => (
                <tr key={`${row.subProductId}:${row.sizeId}`}>
                  <td className="p-3">{row.sizeId}</td>
                  <td className="p-3">{costMoney(row.actualUsageMinor)}</td>
                  <td className="p-3">
                    {costMoney(row.theoreticalUsageMinor)}
                  </td>
                  <td className="p-3">{costMoney(row.varianceMinor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
