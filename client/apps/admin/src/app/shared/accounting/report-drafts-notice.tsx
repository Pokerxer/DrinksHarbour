'use client';

import { PiFileText } from 'react-icons/pi';

/**
 * Discloses that draft entries exist and are not in these figures.
 *
 * Every report reads only `posted` entries. Without this, a trial balance that
 * silently omits 40 pending entries is indistinguishable from a final one, and
 * the numbers get signed off.
 */
export default function DraftsExcludedNotice({ count }: { count?: number }) {
  if (!count || count <= 0) return null;
  return (
    <div
      role="status"
      className="mb-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900"
    >
      <PiFileText size={16} className="mt-0.5 shrink-0" />
      <p>
        <span className="font-semibold">
          {count} draft {count === 1 ? 'entry' : 'entries'} excluded.
        </span>{' '}
        These reports total posted entries only. Post or delete the drafts and
        the figures will change.
      </p>
    </div>
  );
}
