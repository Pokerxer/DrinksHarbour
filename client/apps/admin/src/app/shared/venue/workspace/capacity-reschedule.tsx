'use client';
import { useState } from 'react';
import { venueLocalToInstant, venueWallTime } from 'commerce-core';
import type { RequestRow } from '@/services/venue/experience';
import CapacityAcceptance, {
  type CapacityAvailability,
} from './capacity-acceptance';
import { buttonClass, fieldClass, hintClass } from './controls';

type Amendment = {
  guest: RequestRow['guest'];
  partySize: number;
  bookingAt: string;
};

export default function CapacityReschedule({
  row,
  tables,
  busy,
  load,
  accept,
}: {
  row: RequestRow;
  tables: { _id: string; name: string }[];
  busy: boolean;
  load: (proposal: RequestRow) => Promise<CapacityAvailability>;
  accept: (input: {
    resourceIds: string[];
    policyVersion: number;
    amendment: Amendment;
  }) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [wall, setWall] = useState(venueWallTime(row.bookingAt, row.policy.timezone));
  const [party, setParty] = useState(row.partySize);
  const proposal = () => ({
    ...row,
    partySize: party,
    bookingAt: venueLocalToInstant(wall, row.policy.timezone),
  });
  return (
    <div className="space-y-3">
      <button
        className={buttonClass}
        disabled={busy}
        onClick={() => setEditing(!editing)}
      >
        {editing ? 'Close booking change' : 'Review booking change'}
      </button>
      {editing && (
        <div className="space-y-3 rounded-xl border border-muted bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/60">
          <p className="text-sm leading-6 text-gray-700 dark:text-gray-200">
            The existing commitment stays valid unless the new interval is
            secured successfully.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm font-medium">
              New venue-local booking time
              <input
                type="datetime-local"
                className={`${fieldClass} w-auto`}
                value={wall}
                onChange={(e) => setWall(e.target.value)}
              />
            </label>
            <label className="text-sm font-medium">
              New party size
              <input
                type="number"
                min="1"
                max="100"
                className={`${fieldClass} w-24`}
                value={party}
                onChange={(e) => setParty(Number(e.target.value))}
              />
            </label>
          </div>
          <p className={`${hintClass} flex items-center gap-1.5`}>
            Timezone: {row.policy.timezone}
          </p>
          <CapacityAcceptance
            key={`${wall}:${party}`}
            tables={tables}
            busy={busy}
            load={() => load(proposal())}
            accept={async (input) => {
              const { bookingAt, partySize } = proposal();
              const result = await accept({
                ...input,
                amendment: {
                  guest: row.guest,
                  partySize,
                  bookingAt,
                },
              });
              if (result) setEditing(false);
              return result;
            }}
          />
        </div>
      )}
    </div>
  );
}
