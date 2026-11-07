import { expect, it } from 'vitest';
import { buildCycleResultsPdf } from './cycle-results-pdf';
import type { AppraisalCycle } from '@/services/appraisal.service';
import type { PeerProgress } from '@/services/peerAppraisal.service';
const cycle: AppraisalCycle = {
  _id: 'cycle-id',
  name: 'October',
  mode: 'peer_rating',
  status: 'closed',
  peerReviewEnabled: false,
  closedAt: '2026-10-20T22:58:29Z',
};
const person = {
  employee: 'ada',
  displayName: 'Ada',
  allocationMinor: 0,
  submittedAt: null,
  unavailable: false,
  result: {
    averageScore: 4,
    ratingCount: 7,
    allocationMinor: 0,
    bonusMinor: 0,
    currency: 'NGN' as const,
    composite: {
      weights: { appraisal: 80, exam: 0, attendance: 20 },
      appraisalScore: 80,
      attendanceScore: 84,
      combinedScore: 80.8,
      attendanceFrom: '2026-09-20',
      attendanceTo: '2026-10-20',
    },
  },
};
const progress: PeerProgress = {
  status: 'closed',
  total: 1,
  submitted: 8,
  participants: [person],
};
it('exports a real printable PDF using final scores and real zero bonuses', () => {
  const doc = buildCycleResultsPdf(cycle, progress);
  const text = doc.output();
  expect(text.startsWith('%PDF-')).toBe(true);
  expect(text).toContain('80.80');
  expect(text).toContain('NGN 0.00');
  expect(text).toContain('Not assigned');
  expect(text).toContain('2026-09-20');
});
it('rejects unfinished cycles and missing results instead of printing zeros', () => {
  expect(() =>
    buildCycleResultsPdf({ ...cycle, status: 'collecting' }, progress)
  ).toThrow(/closed/i);
  expect(() =>
    buildCycleResultsPdf(cycle, {
      ...progress,
      participants: [{ ...person, result: undefined }],
    })
  ).toThrow(/result/i);
});
it('retains legacy rating-only totals and repeats all employees across pages', () => {
  const participants = Array.from({ length: 90 }, (_, i) => ({
    ...person,
    employee: `${i}`,
    displayName: `Employee ${i}`,
    result: { ...person.result, composite: undefined, averageScore: 3.5 },
  }));
  const doc = buildCycleResultsPdf(cycle, {
    ...progress,
    total: 90,
    participants,
  });
  expect(doc.getNumberOfPages()).toBeGreaterThan(1);
  expect(doc.output()).toContain('Employee 89');
  expect(doc.output()).toContain('70.00');
});
