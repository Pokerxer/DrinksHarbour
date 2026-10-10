import NotificationFeatureHeader from '../notification-feature-header';
import type { InsightPlan } from '@/services/notificationInsights.service';
export default function InsightShell({
  title,
  description,
  plan,
  loading,
  error,
  children,
  header,
  refresh,
  warehouse,
}: {
  title: string;
  description: string;
  plan: InsightPlan | null;
  loading: boolean;
  error: string;
  children: React.ReactNode;
  header?: React.ReactNode;
  refresh?: () => void;
  warehouse?: string;
}) {
  return (
    <section className="space-y-5 pb-8">
      {header ?? (
        <NotificationFeatureHeader
          title={title}
          description={description}
          updatedAt={plan?.generatedAt}
          warehouse={warehouse}
          loading={loading}
          refreshLabel={error ? 'Try again' : 'Refresh insights'}
          refresh={refresh || (() => {})}
        />
      )}
      {error && (
        <p
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {loading && !plan && (
        <p
          role="status"
          className="rounded-xl border bg-white p-8 text-center text-gray-500"
        >
          Reading stock and purchase/sales history…
        </p>
      )}
      {plan?.warnings.map((w) => (
        <p
          key={w}
          className="rounded-xl bg-amber-50 p-3 text-xs text-amber-800"
        >
          {w}
        </p>
      ))}
      {children}
    </section>
  );
}
