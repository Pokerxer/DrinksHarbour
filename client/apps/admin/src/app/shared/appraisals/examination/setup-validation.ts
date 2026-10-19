import type { ExamConfiguration } from '@/services/examination.service';
function dateTime(value?: string) {
  if (
    !value ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    Number(value.slice(0, 4)) < 2000
  )
    return NaN;
  const time = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time
    : NaN;
}
export function setupIssues(config: ExamConfiguration): string[] {
  const issues: string[] = [];
  const from = dateTime(config.attendanceFrom),
    to = dateTime(config.attendanceTo);
  if (!Number.isFinite(from) || !Number.isFinite(to))
    issues.push('Choose valid attendance start and end dates.');
  else if (to < from)
    issues.push('Attendance end date must be on or after the start date.');
  else if (to - from >= 366 * 86400000)
    issues.push('Choose an attendance period of no more than 366 days.');
  if (
    !Number.isInteger(config.durationMinutes) ||
    (config.durationMinutes ?? 0) < 1 ||
    (config.durationMinutes ?? 0) > 240
  )
    issues.push('Set a whole-number duration from 1 to 240 minutes.');
  if (!config.departments.length)
    issues.push('Select at least one examination department.');
  if (config.questions.length < 10 || config.questions.length > 100)
    issues.push('Your bank needs between 10 and 100 questions.');
  const seen = new Set<string>();
  config.questions.forEach((q, i) => {
    const n = i + 1,
      prompt = q.prompt.trim().toLowerCase(),
      marks = q.marks ?? config.marksPerQuestion ?? 2;
    if (!prompt || q.prompt.trim().length > 500)
      issues.push(`Question ${n} needs a prompt of 1–500 characters.`);
    else if (seen.has(prompt))
      issues.push(`Question ${n} repeats another question.`);
    seen.add(prompt);
    if (!Number.isInteger(marks) || marks < 1 || marks > 20)
      issues.push(`Question ${n} needs whole-number marks from 1 to 20.`);
    if (
      q.options.length < 2 ||
      q.options.length > 6 ||
      q.options.some((o) => !o.trim() || o.trim().length > 300) ||
      new Set(q.options.map((o) => o.trim().toLowerCase())).size !==
        q.options.length
    )
      issues.push(
        `Question ${n} needs 2–6 distinct, non-empty options of up to 300 characters.`
      );
    if (
      !Number.isInteger(q.correctOption) ||
      q.correctOption < 0 ||
      q.correctOption >= q.options.length
    )
      issues.push(`Question ${n} needs a valid correct answer.`);
  });
  return issues;
}
