'use client';
import { useCallback, useEffect, useState, type ComponentProps } from 'react';
import NotificationList from '../notification-list';
import NotificationDetailPanel from '../notification-detail-panel';
import type { TenantNotice } from '@/services/notification.service';
function displayNotice(notice: TenantNotice) {
  const expiry = Date.parse(String(notice.metadata.expiryDate || ''));
  if (Number.isFinite(expiry) && expiry <= Date.now())
    return {
      ...notice,
      title: 'Batch expired',
      priority: 'urgent',
      message:
        'This recorded batch has expired. Review quarantine and removal from usable stock.',
    };
  if (notice.metadata.quarantineStatus === 'quarantined')
    return {
      ...notice,
      title: 'Batch quarantined',
      message: 'Review the quarantine before picking or moving this batch.',
    };
  return notice;
}
export default function ExpiryAlertsList(
  props: ComponentProps<typeof NotificationList>
) {
  const [selectedId, setSelected] = useState<string | null>(null);
  const close = useCallback(() => setSelected(null), []);
  const notifications = props.notifications.map(displayNotice);
  const selected = notifications.find((n) => n._id === selectedId) || null;
  useEffect(() => {
    if (!props.loading && selectedId && !selected) setSelected(null);
  }, [props.loading, selectedId, selected]);
  if (!props.loading && !props.error && !notifications.length)
    return (
      <div className="p-8 text-center">
        <p className="font-semibold">No expiry alerts match your filters</p>
        <p className="mt-2 text-sm text-gray-500">
          Tracked batches with remaining units and an expiry date appear within
          your configured warning window after the daily scan. Try another
          expiry range or clear the status and read filters.
        </p>
      </div>
    );
  return (
    <>
      <p className="border-b bg-gray-50 p-4 text-xs text-gray-500">
        Batch quantity and quarantine status are recorded at the latest scan.
        Confirm current inventory before taking action.
      </p>
      <div className="relative flex min-h-[360px]">
        <div className="min-w-0 flex-1">
          <NotificationList
            {...props}
            notifications={notifications}
            onOpen={setSelected}
          />
        </div>
        {selected && (
          <NotificationDetailPanel notice={selected} close={close} />
        )}
      </div>
    </>
  );
}
