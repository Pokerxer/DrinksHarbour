import { expect, it } from 'vitest';
import { setupIssues } from './setup-validation';
const valid = () => ({
  attendanceFrom: '2026-09-01',
  attendanceTo: '2026-09-30',
  durationMinutes: 30,
  departments: ['d'],
  questions: Array.from({ length: 10 }, (_, i) => ({
    prompt: `Question ${i}`,
    options: ['A', 'B'],
    correctOption: 0,
    marks: 2,
  })),
});
it('explains invalid ranges and periods over 366 days', () => {
  expect(setupIssues(valid())).toEqual([]);
  expect(setupIssues({ ...valid(), attendanceFrom: '2026-02-30' })).toContain(
    'Choose valid attendance start and end dates.'
  );
  expect(setupIssues({ ...valid(), attendanceTo: '2026-08-31' })).toContain(
    'Attendance end date must be on or after the start date.'
  );
  expect(setupIssues({ ...valid(), attendanceTo: '2028-09-30' })).toContain(
    'Choose an attendance period of no more than 366 days.'
  );
});
it('identifies the exact question with an invalid mark, key or duplicate prompt', () => {
  const config = valid();
  config.questions[6].marks = 0;
  config.questions[8].correctOption = 4;
  config.questions[9].prompt = ' Question 0 ';
  expect(setupIssues(config)).toContain(
    'Question 7 needs whole-number marks from 1 to 20.'
  );
  expect(setupIssues(config)).toContain(
    'Question 9 needs a valid correct answer.'
  );
  expect(setupIssues(config)).toContain(
    'Question 10 repeats another question.'
  );
});
