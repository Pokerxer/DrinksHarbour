'use client';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import NotificationList from '../notification-list';
import NotificationDetailPanel from '../notification-detail-panel';

export default function ProductUpdatesList(
  props: ComponentProps<typeof NotificationList>
) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const close = useCallback(() => setSelectedId(null), []);
  const selected =
    props.notifications.find((notice) => notice._id === selectedId) || null;
  useEffect(() => {
    if (!props.loading && selectedId && !selected) setSelectedId(null);
  }, [props.loading, selectedId, selected]);
  if (!props.loading && !props.error && props.notifications.length === 0)
    return (
      <div className="px-6 py-10 text-center">
        <p className="font-semibold text-gray-800">No product updates</p>
        <p className="mt-2 text-sm text-gray-500">
          Approval decisions matching your filters will appear here. Try a wider
          timeframe or clear the decision and read filters.
        </p>
      </div>
    );
  return (
    <div className="relative flex min-h-[360px]">
      <div className="min-w-0 flex-1">
        <NotificationList {...props} onOpen={setSelectedId} />
      </div>
      {selected && <NotificationDetailPanel notice={selected} close={close} />}
    </div>
  );
}
