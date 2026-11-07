'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCcw } from 'lucide-react';
import {
  fireCourse,
  getOpenVisitSnapshot,
  holdCourse,
  setCourses,
  type CourseDTO,
  type CourseState,
} from '@/services/venue/ops';
import { buttonClass, EmptyState, fieldClass, Notice, panelClass } from './controls';

/**
 * S3 courses panel (Task 6, minimal honest scope). Loads one open visit's
 * snapshot through the existing bill read (the server echoes the course
 * registry there since S3), shows each course's server-owned state plus the
 * unfired count derived from the session lines, and wires fire/hold/release
 * plus the ordered-registry editor (courses.set). Every command rides the
 * server contracts: `expectedVersion` is the visit version, and a fired course
 * is terminal (repeat fire is a server domain error, never a second send).
 */

const chipOf: Record<CourseState, { label: string; className: string }> = {
  planned: { label: 'Planned', className: 'border-gray-300 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200' },
  hold: { label: 'On hold', className: 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200' },
  fired: { label: 'Fired', className: 'border-green-300 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950/40 dark:text-green-200' },
};

export default function CoursesPanel({
  token,
  visits,
}: {
  token: string;
  /** Open visits from the workspace snapshot ({_id, state, version}). */
  visits: { _id: string; state: string }[];
}) {
  const open = useMemo(() => visits.filter((visit) => visit.state === 'open'), [visits]);
  const [sessionId, setSessionId] = useState('');
  const [snapshot, setSnapshot] = useState<Awaited<ReturnType<typeof getOpenVisitSnapshot>> | null>(null);
  const [registry, setRegistry] = useState<CourseDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const load = useCallback(async (id: string) => {
    const data = await getOpenVisitSnapshot(token, id);
    setSnapshot(data);
    setRegistry(data.courses || []);
    return data;
  }, [token]);
  useEffect(() => {
    const first = open[0]?._id || '';
    setSessionId(first);
    if (first) load(first).catch((e) => setError(e instanceof Error ? e.message : 'Unable to load visit'));
    else setSnapshot(null);
  }, [open, load]);
  async function run(action: () => Promise<unknown>, success: string) {
    if (!sessionId || busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
      await load(sessionId);
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update courses');
    } finally {
      setBusy(false);
    }
  }
  // Unfired units per course, derived ONLY from the session lines DTO.
  const unfiredOf = (courseId: string) =>
    (snapshot?.lines || []).filter((line) => line.courseId === courseId).reduce((sum, line) => sum + Math.max(0, line.quantity - line.firedQuantity), 0);
  const courses = registry || [];
  const version = snapshot?.version ?? 0;
  const courseless = (snapshot?.lines || []).some((line) => !line.courseId && line.quantity > line.firedQuantity);
  return (
    <section aria-label="Courses" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h2 className="text-xl font-semibold">Courses</h2>
          <p className="max-w-2xl text-sm leading-6 text-gray-600 dark:text-gray-300">
            Group the visit&apos;s lines into courses, hold or fire them. Firing
            sends exactly that course&apos;s unfired lines to the kitchen.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block text-sm font-medium">
            Visit
            <select className={fieldClass} value={sessionId} disabled={busy || !open.length} onChange={(e) => { setSessionId(e.target.value); setError(''); setMessage(''); load(e.target.value).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load visit')); }}>
              {open.map((visit) => (
                <option key={visit._id} value={visit._id}>{visit._id.slice(-6)}</option>
              ))}
            </select>
          </label>
          <button type="button" className={buttonClass} disabled={busy || !sessionId} onClick={() => void load(sessionId).catch((e) => setError(e instanceof Error ? e.message : 'Unable to refresh'))}>
            <RefreshCcw aria-hidden="true" className="size-4" />
            Reload
          </button>
        </div>
      </div>
      {error && <Notice tone="error" role="alert">{error}</Notice>}
      {message && <Notice tone="success" role="status">{message}</Notice>}
      {!open.length && <EmptyState message="No open visits at this location. Open a visit to use courses." />}
      {sessionId && snapshot && (
        <>
          <ul className="space-y-2">
            {courses.map((course, index) => {
              const chip = chipOf[course.state];
              const unfired = unfiredOf(course.courseId);
              return (
                <li key={course.courseId} className={`${panelClass} flex flex-wrap items-center justify-between gap-3`}>
                  <div className="min-w-0">
                    <p className="font-medium">
                      {index + 1}. {course.name || course.courseId}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {unfired} unfired unit{unfired === 1 ? '' : 's'}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${chip.className}`}>{chip.label}</span>
                    {course.state !== 'fired' && (
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => void run(() => fireCourse(token, sessionId, course.courseId, version), `Course fired. Kitchen received its unfired lines.`)}>
                        Fire
                      </button>
                    )}
                    {course.state === 'planned' && (
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => void run(() => holdCourse(token, sessionId, course.courseId, { expectedVersion: version, to: 'hold' }), 'Course held.')}>
                        Hold
                      </button>
                    )}
                    {course.state === 'hold' && (
                      <button type="button" className={buttonClass} disabled={busy} onClick={() => void run(() => holdCourse(token, sessionId, course.courseId, { expectedVersion: version, to: 'planned' }), 'Course released.')}>
                        Release
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {courseless && (
            <p className="text-sm text-gray-600 dark:text-gray-300">Some lines have no course yet — assign one in the order flow to include them here.</p>
          )}
          <RegistryEditor courses={courses} busy={busy} version={version} onChange={setRegistry} onSave={() => run(() => setCourses(token, sessionId, { expectedVersion: version, courses: (registry || []).map((c) => ({ courseId: c.courseId, ...(c.name ? { name: c.name } : {}) })) }), 'Course registry saved.')} />
        </>
      )}
    </section>
  );
}

/** The ordered registry editor: rename, reorder, add, remove — saved as one full replacement. */
function RegistryEditor({ courses, busy, version, onChange, onSave }: {
  courses: CourseDTO[];
  busy: boolean;
  version: number;
  onChange: (courses: CourseDTO[]) => void;
  onSave: () => void;
}) {
  const move = (index: number, delta: number) => {
    const next = [...courses];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next.map((course, order) => ({ ...course, order })));
  };
  const valid = courses.every((course) => !!course.courseId.trim() && course.courseId.trim().length <= 50)
    && new Set(courses.map((course) => course.courseId.trim())).size === courses.length;
  return (
    <div className={panelClass}>
      <h3 className="font-medium">Course registry</h3>
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Full ordered list, version-checked (v{version}). A fired line keeps its course — the server rejects dropping it.</p>
      <ul className="mt-3 space-y-2">
        {courses.map((course, index) => (
          <li key={index} className="flex flex-wrap items-center gap-2">
            <input aria-label={`Course id ${index + 1}`} className={fieldClass} value={course.courseId} placeholder="starters" maxLength={50} disabled={busy} onChange={(e) => onChange(courses.map((c, i) => (i === index ? { ...c, courseId: e.target.value } : c)))} />
            <input aria-label={`Name for course ${index + 1}`} className={fieldClass} value={course.name || ''} placeholder="Display name (optional)" maxLength={100} disabled={busy} onChange={(e) => onChange(courses.map((c, i) => (i === index ? { ...c, name: e.target.value || undefined } : c)))} />
            <button type="button" className={buttonClass} disabled={busy || index === 0} onClick={() => move(index, -1)} aria-label={`Move course ${index + 1} up`}>↑</button>
            <button type="button" className={buttonClass} disabled={busy || index === courses.length - 1} onClick={() => move(index, 1)} aria-label={`Move course ${index + 1} down`}>↓</button>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex gap-2">
        <button type="button" className={buttonClass} disabled={busy || courses.length >= 50} onClick={() => onChange([...courses, { courseId: '', name: undefined, order: courses.length, state: 'planned' as CourseState }])}>
          Add course
        </button>
        <button type="button" className={buttonClass} disabled={busy || !valid} onClick={onSave}>
          Save registry
        </button>
      </div>
    </div>
  );
}
