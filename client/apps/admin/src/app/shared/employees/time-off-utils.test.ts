import { describe, it, expect } from 'vitest';
import {
  TIME_OFF_TRANSITIONS,
  SWAP_TRANSITIONS,
  requestDayRange,
  requestDayLabel,
  daysLabel,
  timeOffTypeLabel,
  timeOffStatusTone,
  swapStatusTone,
  swapStatusLabel,
  swapTargetLabel,
  shiftWindowLabel,
  timeOffActions,
  swapActions,
  groupTimeOff,
  summariseTimeOff,
} from './time-off-utils';
import type {
  TimeOffRequest,
  ShiftSwapRequest,
} from '@/services/timeOff.service';

const OFFSET = 60;

/**
 * A request as the server stores it: a HALF-OPEN window in absolute UTC.
 * 10 Aug 2026 whole day at UTC+1 is 09T23:00 → 10T23:00.
 */
function req(over: Partial<TimeOffRequest> = {}): TimeOffRequest {
  return {
    _id: 'r1',
    employee: { _id: 'e1', firstName: 'Ada', lastName: 'Obi' },
    type: 'annual',
    startDate: '2026-08-09T23:00:00.000Z',
    endDate: '2026-08-10T23:00:00.000Z',
    halfDay: 'none',
    days: 1,
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

function swap(over: Partial<ShiftSwapRequest> = {}): ShiftSwapRequest {
  return {
    _id: 's1',
    shift: {
      _id: 'sh1',
      start: '2026-08-10T08:00:00.000Z',
      end: '2026-08-10T16:00:00.000Z',
      status: 'published',
      role: { _id: 'ro1', name: 'Driver' },
    },
    requestedBy: { _id: 'e1', firstName: 'Ada', lastName: 'Obi' },
    targetEmployee: null,
    status: 'pending',
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  };
}

describe('reading a stored window back as local days', () => {
  it('reports the inclusive last day, not the exclusive end instant', () => {
    // The naive read of endDate would say the 11th — the day the leave ends,
    // which is a day the employee is at work.
    expect(requestDayRange(req(), OFFSET)).toEqual({
      from: '2026-08-10',
      to: '2026-08-10',
    });
  });

  it('spans a multi-day request', () => {
    expect(
      requestDayRange(
        req({ endDate: '2026-08-12T23:00:00.000Z', days: 3 }),
        OFFSET
      )
    ).toEqual({ from: '2026-08-10', to: '2026-08-12' });
  });

  it('keeps a half day on its own day', () => {
    const pm = req({
      startDate: '2026-08-10T11:00:00.000Z',
      endDate: '2026-08-10T23:00:00.000Z',
      halfDay: 'pm',
      days: 0.5,
    });
    expect(requestDayRange(pm, OFFSET)).toEqual({
      from: '2026-08-10',
      to: '2026-08-10',
    });
  });
});

describe('labels a human reads', () => {
  it('names a single day', () => {
    expect(requestDayLabel(req(), OFFSET)).toBe('Mon 10 Aug');
  });

  it('names a range', () => {
    expect(
      requestDayLabel(req({ endDate: '2026-08-12T23:00:00.000Z' }), OFFSET)
    ).toBe('Mon 10 Aug – Wed 12 Aug');
  });

  it('says which half of the day a half day is', () => {
    const am = req({
      endDate: '2026-08-10T11:00:00.000Z',
      halfDay: 'am',
      days: 0.5,
    });
    expect(requestDayLabel(am, OFFSET)).toBe('Mon 10 Aug, morning');

    const pm = req({
      startDate: '2026-08-10T11:00:00.000Z',
      halfDay: 'pm',
      days: 0.5,
    });
    expect(requestDayLabel(pm, OFFSET)).toBe('Mon 10 Aug, afternoon');
  });

  it('counts a half day as a half day, never as one', () => {
    expect(daysLabel(0.5)).toBe('½ day');
    expect(daysLabel(1)).toBe('1 day');
    expect(daysLabel(3)).toBe('3 days');
    expect(daysLabel(2.5)).toBe('2½ days');
    expect(daysLabel(0)).toBe('—');
  });

  it('gives every type a word', () => {
    expect(timeOffTypeLabel('annual')).toBe('Annual leave');
    expect(timeOffTypeLabel('sick')).toBe('Sick leave');
    expect(timeOffTypeLabel('parental')).toBe('Parental leave');
    expect(timeOffTypeLabel('unpaid')).toBe('Unpaid leave');
    expect(timeOffTypeLabel('other')).toBe('Other');
  });

  it('an open swap says so rather than showing a blank', () => {
    expect(swapTargetLabel(swap())).toBe('Open to anyone');
    expect(
      swapTargetLabel(
        swap({ targetEmployee: { _id: 'e2', firstName: 'Bimpe' } })
      )
    ).toBe('Bimpe');
  });

  it('describes the shift a swap is about', () => {
    expect(shiftWindowLabel(swap().shift, OFFSET)).toBe(
      'Mon 10 Aug · 09:00–17:00'
    );
  });

  it('an unpopulated shift ref is an em dash, never "Invalid Date"', () => {
    expect(shiftWindowLabel('sh1', OFFSET)).toBe('—');
    expect(shiftWindowLabel(null, OFFSET)).toBe('—');
  });

  it('distinguishes accepted from approved — they are different gates', () => {
    expect(swapStatusLabel('accepted')).toBe('Awaiting approval');
    expect(swapStatusLabel('approved')).toBe('Approved');
    expect(swapStatusLabel('pending')).toBe('Awaiting a taker');
  });

  it('gives every status a distinct tone', () => {
    const tones = [
      timeOffStatusTone('pending'),
      timeOffStatusTone('approved'),
      timeOffStatusTone('rejected'),
      timeOffStatusTone('cancelled'),
    ];
    expect(new Set(tones).size).toBe(4);
    expect(swapStatusTone('accepted')).not.toBe(swapStatusTone('approved'));
  });
});

describe('which buttons to offer', () => {
  it('an admin may approve or reject a pending request', () => {
    const actions = timeOffActions(req(), { canDecide: true, isMine: false });
    expect(actions.map((a) => a.action)).toEqual([
      'approve',
      'reject',
      'cancel',
    ]);
  });

  it('the person who filed it may cancel it but not approve it', () => {
    const actions = timeOffActions(req(), { canDecide: false, isMine: true });
    expect(actions.map((a) => a.action)).toEqual(['cancel']);
  });

  it('somebody else’s request offers a non-admin nothing', () => {
    expect(timeOffActions(req(), { canDecide: false, isMine: false })).toEqual(
      []
    );
  });

  it('approved leave can still be cancelled, which releases the roster block', () => {
    const approved = req({ status: 'approved' });
    expect(
      timeOffActions(approved, { canDecide: true, isMine: false }).map(
        (a) => a.action
      )
    ).toEqual(['cancel']);
  });

  it('a rejected request is final and offers nothing at all', () => {
    expect(
      timeOffActions(req({ status: 'rejected' }), {
        canDecide: true,
        isMine: true,
      })
    ).toEqual([]);
    expect(
      timeOffActions(req({ status: 'cancelled' }), {
        canDecide: true,
        isMine: true,
      })
    ).toEqual([]);
  });

  it('never offers an action the transition table forbids', () => {
    // The client only decides which buttons to draw; the server decides what
    // happens. Drawing one the server will refuse is a promise it cannot keep.
    for (const status of [
      'pending',
      'approved',
      'rejected',
      'cancelled',
    ] as const) {
      const offered = timeOffActions(req({ status }), {
        canDecide: true,
        isMine: true,
      });
      const legal = TIME_OFF_TRANSITIONS[status];
      for (const a of offered) expect(legal).toContain(a.to);
    }
  });

  it('a manager cannot approve a swap nobody has accepted', () => {
    const offered = swapActions(swap(), {
      canDecide: true,
      isMine: false,
      isTarget: false,
    });
    expect(offered.map((a) => a.action)).not.toContain('approve');
  });

  it('a manager approves once the target has accepted', () => {
    const offered = swapActions(swap({ status: 'accepted' }), {
      canDecide: true,
      isMine: false,
      isTarget: false,
    });
    expect(offered.map((a) => a.action)).toEqual(['approve', 'reject']);
  });

  it('anyone may claim an open pending swap that is not their own', () => {
    const offered = swapActions(swap(), {
      canDecide: false,
      isMine: false,
      isTarget: false,
    });
    expect(offered.map((a) => a.action)).toEqual(['accept', 'reject']);
  });

  it('the person offering a shift cannot accept it back off themselves', () => {
    const offered = swapActions(swap(), {
      canDecide: false,
      isMine: true,
      isTarget: false,
    });
    expect(offered.map((a) => a.action)).toEqual(['cancel']);
  });

  it('a named target answers, and nobody else does', () => {
    const named = swap({ targetEmployee: { _id: 'e2', firstName: 'Bimpe' } });
    expect(
      swapActions(named, {
        canDecide: false,
        isMine: false,
        isTarget: true,
      }).map((a) => a.action)
    ).toEqual(['accept', 'reject']);
    expect(
      swapActions(named, { canDecide: false, isMine: false, isTarget: false })
    ).toEqual([]);
  });

  it('an approved swap is finished — the shift has already moved', () => {
    expect(
      swapActions(swap({ status: 'approved' }), {
        canDecide: true,
        isMine: true,
        isTarget: true,
      })
    ).toEqual([]);
  });

  it('never offers a swap action the transition table forbids', () => {
    for (const status of [
      'pending',
      'accepted',
      'approved',
      'rejected',
      'cancelled',
    ] as const) {
      const offered = swapActions(swap({ status }), {
        canDecide: true,
        isMine: true,
        isTarget: true,
      });
      for (const a of offered) expect(SWAP_TRANSITIONS[status]).toContain(a.to);
    }
  });
});

describe('the list', () => {
  const today = '2026-08-10';

  it('puts what needs answering first, then what is still to come', () => {
    const groups = groupTimeOff(
      [
        req({
          _id: 'past',
          status: 'approved',
          startDate: '2026-07-01T23:00:00.000Z',
          endDate: '2026-07-02T23:00:00.000Z',
        }),
        req({
          _id: 'soon',
          status: 'approved',
          startDate: '2026-08-20T23:00:00.000Z',
          endDate: '2026-08-21T23:00:00.000Z',
        }),
        req({ _id: 'ask', status: 'pending' }),
      ],
      { today, offsetMinutes: OFFSET }
    );
    expect(groups.map((g) => g.key)).toEqual(['awaiting', 'upcoming', 'past']);
    expect(groups[0].items.map((i) => i._id)).toEqual(['ask']);
    expect(groups[1].items.map((i) => i._id)).toEqual(['soon']);
    expect(groups[2].items.map((i) => i._id)).toEqual(['past']);
  });

  it('leave finishing today is still upcoming, not history', () => {
    // The exclusive end is the instant it finishes, so a comparison against the
    // START of today would file somebody's current holiday under "past".
    const groups = groupTimeOff([req({ status: 'approved' })], {
      today,
      offsetMinutes: OFFSET,
    });
    expect(groups.find((g) => g.key === 'upcoming')?.items).toHaveLength(1);
  });

  it('a rejected or cancelled request is history whatever its dates', () => {
    const groups = groupTimeOff(
      [
        req({
          _id: 'no',
          status: 'rejected',
          startDate: '2026-09-01T23:00:00.000Z',
          endDate: '2026-09-02T23:00:00.000Z',
        }),
      ],
      { today, offsetMinutes: OFFSET }
    );
    expect(groups.find((g) => g.key === 'past')?.items).toHaveLength(1);
    expect(groups.find((g) => g.key === 'upcoming')?.items).toHaveLength(0);
  });

  it('sorts each group by when the leave starts, soonest first', () => {
    const groups = groupTimeOff(
      [
        req({
          _id: 'b',
          startDate: '2026-08-20T23:00:00.000Z',
          endDate: '2026-08-21T23:00:00.000Z',
        }),
        req({
          _id: 'a',
          startDate: '2026-08-15T23:00:00.000Z',
          endDate: '2026-08-16T23:00:00.000Z',
        }),
      ],
      { today, offsetMinutes: OFFSET }
    );
    expect(groups[0].items.map((i) => i._id)).toEqual(['a', 'b']);
  });

  it('counts the headline numbers, with approved days to the nearest half', () => {
    const summary = summariseTimeOff([
      req({ status: 'pending', days: 3 }),
      req({ status: 'approved', days: 0.5 }),
      req({ status: 'approved', days: 2 }),
      req({ status: 'rejected', days: 5 }),
      req({ status: 'cancelled', days: 5 }),
    ]);
    expect(summary).toEqual({
      total: 5,
      pending: 1,
      approved: 2,
      // Rejected and cancelled days are not days off — counting them would
      // report leave nobody is taking.
      approvedDays: 2.5,
    });
  });
});
