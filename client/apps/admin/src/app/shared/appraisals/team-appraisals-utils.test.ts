import { describe, expect, it } from 'vitest';
import {
  TEAM_SORTS,
  filterTeamAppraisals,
  isRowOverdue,
  managerActionFor,
  sortTeamAppraisals,
  teamCycleOptions,
  teamSummary,
} from './team-appraisals-utils';
import type { Appraisal, AppraisalState } from '@/services/appraisal.service';

const NOW = new Date('2026-06-15T12:00:00.000Z').getTime();
const PAST = '2026-06-01T00:00:00.000Z';
const SOON = '2026-06-16T00:00:00.000Z';
const LATER = '2026-09-01T00:00:00.000Z';

function row(
  id: string,
  state: AppraisalState,
  over: {
    first?: string;
    last?: string;
    email?: string;
    jobTitle?: string;
    cycleId?: string;
    cycleName?: string;
    deadline?: string | undefined;
  } = {}
): Appraisal {
  return {
    _id: id,
    state,
    employee: {
      _id: `u-${id}`,
      firstName: over.first ?? 'Ada',
      lastName: over.last ?? 'Lovelace',
      email: over.email ?? `${id}@wyncity.test`,
      employeeProfile: { work: { jobTitle: over.jobTitle ?? 'Engineer' } },
    },
    manager: { _id: 'm1', firstName: 'Grace', lastName: 'Hopper' },
    cycle: {
      _id: over.cycleId ?? 'c1',
      name: over.cycleName ?? 'H1 2026',
      status: 'collecting',
      feedbackDeadline: 'deadline' in over ? over.deadline : LATER,
    },
  } as Appraisal;
}

describe('managerActionFor', () => {
  it('flags only the states actually blocked on the manager', () => {
    expect(managerActionFor('summarising')).toEqual({
      label: 'Write summary',
      needsAction: true,
    });
    expect(managerActionFor('pending_peer_approval').needsAction).toBe(true);
  });

  it('treats states waiting on someone else as status, not as a task', () => {
    for (const s of [
      'collecting',
      'nominating',
      'draft',
      'released',
      'acknowledged',
      'cancelled',
    ] as AppraisalState[]) {
      expect(managerActionFor(s).needsAction, s).toBe(false);
      expect(managerActionFor(s).label, s).toBeTruthy();
    }
  });

  it('degrades to a usable label for a state this bundle does not know', () => {
    const action = managerActionFor('brand_new_state' as AppraisalState);
    expect(action).toEqual({ label: 'Open', needsAction: false });
  });
});

describe('isRowOverdue', () => {
  it('is true for a live appraisal past its cycle deadline', () => {
    expect(isRowOverdue(row('a', 'collecting', { deadline: PAST }), NOW)).toBe(
      true
    );
  });

  it('is false once the appraisal has finished', () => {
    // A released or acknowledged review is done; a past cycle deadline must not
    // mark completed work as a problem forever.
    for (const s of [
      'released',
      'acknowledged',
      'cancelled',
    ] as AppraisalState[]) {
      expect(isRowOverdue(row('a', s, { deadline: PAST }), NOW), s).toBe(false);
    }
  });

  it('is false without a deadline', () => {
    expect(
      isRowOverdue(row('a', 'collecting', { deadline: undefined }), NOW)
    ).toBe(false);
  });
});

describe('sortTeamAppraisals', () => {
  it('puts manager-blocked states above in-flight ones', () => {
    const rows = [
      row('collect', 'collecting'),
      row('ack', 'acknowledged'),
      row('summ', 'summarising'),
      row('peers', 'pending_peer_approval'),
    ];
    expect(sortTeamAppraisals(rows).map((r) => r._id)).toEqual([
      'summ',
      'peers',
      'collect',
      'ack',
    ]);
  });

  it('breaks a state tie by soonest deadline', () => {
    const rows = [
      row('later', 'collecting', { deadline: LATER }),
      row('overdue', 'collecting', { deadline: PAST }),
      row('soon', 'collecting', { deadline: SOON }),
    ];
    expect(sortTeamAppraisals(rows).map((r) => r._id)).toEqual([
      'overdue',
      'soon',
      'later',
    ]);
  });

  it('sorts rows with no deadline last within their state', () => {
    const rows = [
      row('none', 'collecting', { deadline: undefined }),
      row('dated', 'collecting', { deadline: LATER }),
    ];
    expect(sortTeamAppraisals(rows).map((r) => r._id)).toEqual([
      'dated',
      'none',
    ]);
  });

  it('falls back to employee name so the order is stable across reloads', () => {
    const rows = [
      row('z', 'collecting', { first: 'Zoe', deadline: undefined }),
      row('a', 'collecting', { first: 'Alan', deadline: undefined }),
    ];
    expect(sortTeamAppraisals(rows).map((r) => r._id)).toEqual(['a', 'z']);
  });

  it('sorts an unknown state last instead of scrambling the list', () => {
    // A NaN comparison lets Array.sort return any order at all.
    const rows = [
      row('weird', 'not_a_state' as AppraisalState),
      row('summ', 'summarising'),
      row('ack', 'acknowledged'),
    ];
    expect(sortTeamAppraisals(rows).map((r) => r._id)).toEqual([
      'summ',
      'ack',
      'weird',
    ]);
  });

  it('does not mutate its input', () => {
    const rows = [row('b', 'acknowledged'), row('a', 'summarising')];
    sortTeamAppraisals(rows);
    expect(rows.map((r) => r._id)).toEqual(['b', 'a']);
  });

  // ── selectable orders ───────────────────────────────────────────────────
  // The order used to be fixed. "Outstanding first" is the right DEFAULT, but
  // it is the wrong order for "who is due this week" and useless for "find
  // Chidi", so the manager can now pick. The default argument keeps every
  // existing call site (and every assertion above) on the old behaviour.

  it('sorts by due date, soonest first, when asked', () => {
    const rows = [
      row('ack-soon', 'acknowledged', { deadline: SOON }),
      row('summ-later', 'summarising', { deadline: LATER }),
      row('collect-past', 'collecting', { deadline: PAST }),
    ];
    // State is ignored entirely here — an acknowledged row with a near
    // deadline outranks a summarising one due in September, which is the whole
    // point of choosing a date order.
    expect(sortTeamAppraisals(rows, 'due').map((r) => r._id)).toEqual([
      'collect-past',
      'ack-soon',
      'summ-later',
    ]);
  });

  it('still sorts undated rows last when sorting by due date', () => {
    const rows = [
      row('none', 'collecting', { deadline: undefined }),
      row('dated', 'collecting', { deadline: LATER }),
    ];
    expect(sortTeamAppraisals(rows, 'due').map((r) => r._id)).toEqual([
      'dated',
      'none',
    ]);
  });

  it('sorts by employee name A-Z when asked', () => {
    const rows = [
      row('z', 'summarising', { first: 'Zoe' }),
      row('c', 'collecting', { first: 'Chidi' }),
      row('a', 'acknowledged', { first: 'Ada' }),
    ];
    expect(sortTeamAppraisals(rows, 'name').map((r) => r._id)).toEqual([
      'a',
      'c',
      'z',
    ]);
  });

  it('sorts by status in LIFECYCLE order, not urgency order', () => {
    // Deliberately different from the default: 'priority' asks "what needs me
    // first", 'status' asks "where is everyone in the pipeline", and a
    // pipeline runs draft → nominating → … → acknowledged. If this returned
    // the urgency order it would be a duplicate of the default and worth
    // deleting.
    const rows = [
      row('ack', 'acknowledged'),
      row('summ', 'summarising'),
      row('draft', 'draft'),
      row('nom', 'nominating'),
    ];
    expect(sortTeamAppraisals(rows, 'status').map((r) => r._id)).toEqual([
      'draft',
      'nom',
      'summ',
      'ack',
    ]);
  });

  it('breaks a tie by employee name in every order', () => {
    for (const sort of ['priority', 'due', 'status'] as const) {
      const rows = [
        row('z', 'collecting', { first: 'Zoe', deadline: LATER }),
        row('a', 'collecting', { first: 'Ada', deadline: LATER }),
      ];
      expect(sortTeamAppraisals(rows, sort).map((r) => r._id), sort).toEqual([
        'a',
        'z',
      ]);
    }
  });

  it('falls back to the default order for an unknown sort key', () => {
    const rows = [row('ack', 'acknowledged'), row('summ', 'summarising')];
    expect(
      sortTeamAppraisals(rows, 'by-vibes' as never).map((r) => r._id)
    ).toEqual(['summ', 'ack']);
  });

  it('does not mutate its input in any order', () => {
    for (const sort of ['priority', 'due', 'name', 'status'] as const) {
      const rows = [row('b', 'acknowledged'), row('a', 'summarising')];
      sortTeamAppraisals(rows, sort);
      expect(rows.map((r) => r._id), sort).toEqual(['b', 'a']);
    }
  });
});

describe('TEAM_SORTS', () => {
  it('offers a label for every order sortTeamAppraisals implements', () => {
    expect(TEAM_SORTS.map((o) => o.value)).toEqual([
      'priority',
      'due',
      'name',
      'status',
    ]);
    for (const o of TEAM_SORTS) expect(o.label).toBeTruthy();
  });
});

describe('teamCycleOptions', () => {
  it('lists each cycle once, by name', () => {
    const rows = [
      row('1', 'collecting', { cycleId: 'c-ops', cycleName: 'Ops H1' }),
      row('2', 'collecting', { cycleId: 'c-sales', cycleName: 'Sales H1' }),
      row('3', 'draft', { cycleId: 'c-ops', cycleName: 'Ops H1' }),
    ];
    expect(teamCycleOptions(rows)).toEqual([
      { value: 'c-ops', label: 'Ops H1' },
      { value: 'c-sales', label: 'Sales H1' },
    ]);
  });

  it('skips rows whose cycle did not come back populated', () => {
    // An unpopulated ref would otherwise put an option in the picker that
    // matches nothing and is labelled '—'.
    const rows = [
      { ...row('1', 'collecting'), cycle: undefined } as unknown as Appraisal,
      row('2', 'collecting', { cycleId: 'c1', cycleName: 'H1 2026' }),
    ];
    expect(teamCycleOptions(rows)).toEqual([
      { value: 'c1', label: 'H1 2026' },
    ]);
  });

  it('is empty for an empty team', () => {
    expect(teamCycleOptions([])).toEqual([]);
  });
});

describe('teamSummary', () => {
  it('counts attention, overdue and complete independently', () => {
    const rows = [
      row('1', 'summarising', { deadline: PAST }),
      row('2', 'collecting', { deadline: PAST }),
      row('3', 'collecting', { deadline: LATER }),
      row('4', 'acknowledged', { deadline: PAST }),
    ];
    // Row 1 is both needing action and overdue — the two counters overlap on
    // purpose; they answer different questions.
    expect(teamSummary(rows, NOW)).toEqual({
      total: 4,
      needsAction: 1,
      overdue: 2,
      complete: 1,
    });
  });

  it('is all zeroes for an empty team', () => {
    expect(teamSummary([], NOW)).toEqual({
      total: 0,
      needsAction: 0,
      overdue: 0,
      complete: 0,
    });
  });
});

describe('filterTeamAppraisals', () => {
  const rows = [
    row('1', 'summarising', { first: 'Ada', cycleName: 'Sales H1' }),
    row('2', 'collecting', {
      first: 'Alan',
      jobTitle: 'Designer',
      cycleName: 'Ops H1',
      deadline: PAST,
    }),
    row('3', 'acknowledged', { first: 'Zoe', cycleName: 'Sales H1' }),
  ];

  it('returns everything by default', () => {
    expect(filterTeamAppraisals(rows, {}, NOW)).toHaveLength(3);
  });

  it('narrows to the manager-blocked rows', () => {
    expect(
      filterTeamAppraisals(rows, { scope: 'needs-action' }, NOW).map(
        (r) => r._id
      )
    ).toEqual(['1']);
  });

  it('narrows to overdue and to complete', () => {
    expect(
      filterTeamAppraisals(rows, { scope: 'overdue' }, NOW).map((r) => r._id)
    ).toEqual(['2']);
    expect(
      filterTeamAppraisals(rows, { scope: 'complete' }, NOW).map((r) => r._id)
    ).toEqual(['3']);
  });

  it('matches on name, job title, email and cycle', () => {
    expect(filterTeamAppraisals(rows, { query: 'zoe' }, NOW)).toHaveLength(1);
    expect(filterTeamAppraisals(rows, { query: 'designer' }, NOW)).toHaveLength(
      1
    );
    expect(filterTeamAppraisals(rows, { query: 'sales' }, NOW)).toHaveLength(2);
    expect(
      filterTeamAppraisals(rows, { query: '2@wyncity' }, NOW)
    ).toHaveLength(1);
  });

  it('ANDs the search terms rather than ORing them', () => {
    // "alan sales" must not match Alan (Ops) just because "sales" hit someone.
    expect(filterTeamAppraisals(rows, { query: 'alan sales' }, NOW)).toEqual(
      []
    );
    expect(
      filterTeamAppraisals(rows, { query: 'ada sales' }, NOW).map((r) => r._id)
    ).toEqual(['1']);
  });

  it('is case-insensitive and ignores padding', () => {
    expect(
      filterTeamAppraisals(rows, { query: '  ZOE  ' }, NOW).map((r) => r._id)
    ).toEqual(['3']);
  });

  it('applies scope and query together', () => {
    expect(
      filterTeamAppraisals(rows, { scope: 'needs-action', query: 'zoe' }, NOW)
    ).toEqual([]);
  });

  // ── cycle ───────────────────────────────────────────────────────────────
  // A manager whose reports are spread across two cycles could not narrow to
  // one: searching the cycle NAME worked only while no employee, job title or
  // other cycle happened to contain the same word.
  const mixed = [
    row('ops', 'collecting', { cycleId: 'c-ops', cycleName: 'Ops H1' }),
    row('sales', 'summarising', { cycleId: 'c-sales', cycleName: 'Sales H1' }),
    row('ops2', 'acknowledged', { cycleId: 'c-ops', cycleName: 'Ops H1' }),
  ];

  it('narrows to one cycle by id', () => {
    expect(
      filterTeamAppraisals(mixed, { cycleId: 'c-ops' }, NOW).map((r) => r._id)
    ).toEqual(['ops', 'ops2']);
  });

  it("treats 'all' and an absent cycle the same way", () => {
    expect(filterTeamAppraisals(mixed, { cycleId: 'all' }, NOW)).toHaveLength(3);
    expect(filterTeamAppraisals(mixed, {}, NOW)).toHaveLength(3);
  });

  it('combines the cycle with scope and query', () => {
    expect(
      filterTeamAppraisals(
        mixed,
        { cycleId: 'c-ops', scope: 'complete' },
        NOW
      ).map((r) => r._id)
    ).toEqual(['ops2']);
    expect(
      filterTeamAppraisals(
        mixed,
        { cycleId: 'c-sales', scope: 'complete' },
        NOW
      )
    ).toEqual([]);
  });

  it('drops rows with no cycle when a specific cycle is selected', () => {
    // …rather than letting an unpopulated ref slip through every filter.
    const orphan = { ...row('x', 'collecting'), cycle: undefined } as unknown as Appraisal;
    expect(
      filterTeamAppraisals([...mixed, orphan], { cycleId: 'c-ops' }, NOW).map(
        (r) => r._id
      )
    ).toEqual(['ops', 'ops2']);
  });
});
