export default function NotificationCoverage({
  loaded,
  total,
  loading,
  failed,
}: {
  loaded: number;
  total: number;
  loading: boolean;
  failed: boolean;
}) {
  if (loading || loaded >= total) return null;
  return (
    <p
      role="status"
      className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800"
    >
      Showing {loaded} of {total} notifications. Search, categories and priority
      filters apply to loaded notices.{' '}
      {failed
        ? 'Retry to load the remaining notices.'
        : 'Choose a narrower timeframe to find older notices.'}
    </p>
  );
}
