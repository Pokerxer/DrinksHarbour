'use client';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiArrowRight,
  PiPlus,
  PiX,
  PiSpinnerGap,
  PiCaretRight,
  PiCaretLeft,
  PiCheck,
  PiTrash,
  PiMapPin,
  PiSquaresFour,
  PiList,
  PiCalendarBlank,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { meetingService } from '@/services/meeting.service';
import type { Meeting } from '@/services/meeting.service';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';

// ─── constants ───────────────────────────────────────────────────
const HOUR_PX = 64;
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];
const MONTH_FULL = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const PALETTES = [
  {
    bg: 'bg-[#b20202]',
    light: 'bg-[#b20202]/8',
    border: 'border-l-[#b20202]',
    text: 'text-[#b20202]',
    dot: '#b20202',
  },
  {
    bg: 'bg-blue-600',
    light: 'bg-blue-50',
    border: 'border-l-blue-600',
    text: 'text-blue-700',
    dot: '#2563eb',
  },
  {
    bg: 'bg-emerald-600',
    light: 'bg-emerald-50',
    border: 'border-l-emerald-600',
    text: 'text-emerald-700',
    dot: '#059669',
  },
  {
    bg: 'bg-violet-600',
    light: 'bg-violet-50',
    border: 'border-l-violet-600',
    text: 'text-violet-700',
    dot: '#7c3aed',
  },
  {
    bg: 'bg-amber-500',
    light: 'bg-amber-50',
    border: 'border-l-amber-500',
    text: 'text-amber-700',
    dot: '#f59e0b',
  },
];

// ─── helpers ─────────────────────────────────────────────────────
function pal(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = seed.charCodeAt(i) + ((h << 5) - h);
  return PALETTES[Math.abs(h) % PALETTES.length];
}
function getWeekStart(d: Date): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - r.getDay());
  r.setHours(0, 0, 0, 0);
  return r;
}
function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}
function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}
function toDatetimeLocal(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
function fmtTime(d: Date) {
  const h = d.getHours(),
    m = d.getMinutes();
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
}
function fmtDuration(start: Date, end: Date) {
  const mins = Math.round((end.getTime() - start.getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60),
    m = mins % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}
function getEventStyle(m: Meeting) {
  const s = new Date(m.start),
    e = new Date(m.end);
  const topMins = s.getHours() * 60 + s.getMinutes();
  const durMins = Math.max(30, (e.getTime() - s.getTime()) / 60000);
  return { top: (topMins / 60) * HOUR_PX, height: (durMins / 60) * HOUR_PX };
}
function nowPx() {
  const n = new Date();
  return ((n.getHours() * 60 + n.getMinutes()) / 60) * HOUR_PX;
}
function ini(name: string) {
  return (
    name
      .split(' ')
      .slice(0, 2)
      .map((w) => w[0] ?? '')
      .join('')
      .toUpperCase() || '?'
  );
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// ─── MiniCalendar ─────────────────────────────────────────────────
function MiniCalendar({
  selected,
  onChange,
  meetingDates,
}: {
  selected: Date;
  onChange: (d: Date) => void;
  meetingDates: Set<string>;
}) {
  const [view, setView] = useState(() => {
    const d = new Date(selected);
    d.setDate(1);
    return d;
  });
  const today = new Date();
  const y = view.getFullYear(),
    mo = view.getMonth();
  const firstDow = new Date(y, mo, 1).getDay();
  const daysInMo = new Date(y, mo + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let i = 1; i <= daysInMo; i++) cells.push(new Date(y, mo, i));

  return (
    <div className="px-3 pb-2 pt-3.5">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-[11px] font-bold text-gray-800">
          {MONTH_FULL[mo]} {y}
        </span>
        <div className="flex gap-0.5">
          <button
            onClick={() => setView(new Date(y, mo - 1, 1))}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiCaretLeft className="h-3 w-3" />
          </button>
          <button
            onClick={() => setView(new Date(y, mo + 1, 1))}
            className="flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <PiCaretRight className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="mb-1.5 grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d, i) => (
          <span
            key={i}
            className="text-[9px] font-bold uppercase tracking-wide text-gray-400"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5 text-center">
        {cells.map((d, i) => {
          if (!d) return <span key={i} />;
          const hasMeeting = meetingDates.has(dayKey(d));
          const isTd = isSameDay(d, today);
          const isSel = isSameDay(d, selected);
          return (
            <div key={i} className="flex flex-col items-center">
              <button
                onClick={() => onChange(d)}
                className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] transition-all ${
                  isSel
                    ? 'bg-[#b20202] font-bold text-white shadow-sm'
                    : isTd
                      ? 'font-bold text-[#b20202] ring-1 ring-[#b20202]/30'
                      : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {d.getDate()}
              </button>
              <span
                className={`h-1 w-1 rounded-full transition-all ${hasMeeting && !isSel ? 'bg-[#b20202]/50' : 'bg-transparent'}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Draft & Modal ────────────────────────────────────────────────
interface Draft {
  title: string;
  description: string;
  start: string;
  end: string;
  location: string;
  attendeesRaw: string;
  notes: string;
  status: string;
}

function MeetingModal({
  draft,
  onField,
  onSave,
  onClose,
  onDelete,
  saving,
  isEdit,
}: {
  draft: Draft;
  onField: (k: keyof Draft, v: string) => void;
  onSave: () => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
  isEdit: boolean;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-12">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[440px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5">
        {/* Header */}
        <div
          className="relative overflow-hidden px-5 pb-4 pt-5"
          style={{
            background:
              'linear-gradient(135deg,#0f0f0f 0%,#1a0606 60%,#0f0f0f 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle,white 1px,transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="flex items-start justify-between gap-3">
            <input
              value={draft.title}
              onChange={(e) => onField('title', e.target.value)}
              placeholder="Meeting title…"
              autoFocus
              className="flex-1 border-0 bg-transparent text-[15px] font-bold text-white placeholder-white/25 focus:outline-none"
            />
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 text-white/40 transition-colors hover:text-white"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>
          {isEdit && (
            <div className="mt-3 flex gap-1.5">
              {(['scheduled', 'done', 'cancelled'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => onField('status', s)}
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                    draft.status === s
                      ? s === 'done'
                        ? 'bg-emerald-500 text-white'
                        : s === 'cancelled'
                          ? 'bg-gray-500 text-white'
                          : 'bg-[#b20202] text-white'
                      : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="space-y-3.5 p-5">
          <div className="grid grid-cols-2 gap-3">
            {(['start', 'end'] as const).map((k) => (
              <div key={k}>
                <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {k === 'start' ? 'Starts' : 'Ends'}
                </label>
                <input
                  type="datetime-local"
                  value={draft[k]}
                  onChange={(e) => onField(k, e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Description
            </label>
            <input
              value={draft.description}
              onChange={(e) => onField('description', e.target.value)}
              placeholder="Brief description…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Location
            </label>
            <input
              value={draft.location}
              onChange={(e) => onField('location', e.target.value)}
              placeholder="Office, Zoom link, phone…"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Attendees
            </label>
            <input
              value={draft.attendeesRaw}
              onChange={(e) => onField('attendeesRaw', e.target.value)}
              placeholder="Names or emails, comma-separated"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>

          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Notes
            </label>
            <textarea
              value={draft.notes}
              onChange={(e) => onField('notes', e.target.value)}
              rows={3}
              placeholder="Agenda, preparation notes…"
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3">
          {isEdit && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-500">
                  Delete this meeting?
                </span>
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-red-500 px-3 py-1 text-xs font-bold text-white hover:bg-red-600"
                >
                  Yes
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  No
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <PiTrash className="h-3.5 w-3.5" /> Delete
              </button>
            )
          ) : (
            <div />
          )}
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#950202] disabled:opacity-60"
            >
              {saving ? (
                <PiSpinnerGap className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PiCheck className="h-3.5 w-3.5" />
              )}
              {isEdit ? 'Save changes' : 'Create meeting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────
export default function PurchasesVendorMeetings({
  vendorId,
}: {
  vendorId: string;
}) {
  const { data: session, status } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<'week' | 'list'>('week');
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentNowPx, setCurrentNowPx] = useState(nowPx);
  const [modal, setModal] = useState<{
    open: boolean;
    meeting: Meeting | null;
  }>({ open: false, meeting: null });
  const [draft, setDraft] = useState<Draft>({
    title: '',
    description: '',
    start: '',
    end: '',
    location: '',
    attendeesRaw: '',
    notes: '',
    status: 'scheduled',
  });
  const [activeAttendees, setActiveAttendees] = useState<Set<string>>(
    new Set(['__all__'])
  );
  const gridRef = useRef<HTMLDivElement>(null);
  const today = new Date();

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );
  const weekEnd = useMemo(() => addDays(weekStart, 6), [weekStart]);

  // Derived sets
  const allAttendees = useMemo(() => {
    const s = new Set<string>();
    meetings.forEach((m) => m.attendees.forEach((a) => s.add(a)));
    return Array.from(s).sort();
  }, [meetings]);

  const meetingDates = useMemo(() => {
    const s = new Set<string>();
    meetings.forEach((m) => s.add(dayKey(new Date(m.start))));
    return s;
  }, [meetings]);

  // Week-range meetings filtered client-side (no re-fetch on navigation)
  const weekMeetings = useMemo(() => {
    const end = addDays(weekEnd, 1);
    return meetings.filter((m) => {
      const d = new Date(m.start);
      return d >= weekStart && d < end;
    });
  }, [meetings, weekStart, weekEnd]);

  const visibleMeetings = useMemo(() => {
    const base = viewMode === 'list' ? meetings : weekMeetings;
    if (activeAttendees.has('__all__')) return base;
    return base.filter((m) => m.attendees.some((a) => activeAttendees.has(a)));
  }, [meetings, weekMeetings, activeAttendees, viewMode]);

  // Sorted + grouped for list view
  const sortedVisible = useMemo(
    () =>
      [...visibleMeetings].sort(
        (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
      ),
    [visibleMeetings]
  );

  const groupedMeetings = useMemo(() => {
    const map = new Map<string, Meeting[]>();
    sortedVisible.forEach((m) => {
      const k = dayKey(new Date(m.start));
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(m);
    });
    return Array.from(map.entries()).map(([k, items]) => {
      const [y, mo, d] = k.split('-').map(Number);
      const date = new Date(y, mo, d);
      const isToday = isSameDay(date, today);
      const isTomorrow = isSameDay(date, addDays(today, 1));
      const label = isToday
        ? 'Today'
        : isTomorrow
          ? 'Tomorrow'
          : date.toLocaleDateString('en-GB', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
      return { k, label, items, isPast: date < today && !isToday };
    });
  }, [sortedVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load ALL vendor meetings once — navigation is client-side
  const load = useCallback(async () => {
    if (status === 'loading' || !token) return;
    setLoading(true);
    try {
      const [v, ms] = await Promise.all([
        vendorService.getById(vendorId, token),
        meetingService.getAll(token, { vendor: vendorId }),
      ]);
      setVendor(v);
      setMeetings(ms);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [vendorId, token, status]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!loading && gridRef.current)
      gridRef.current.scrollTop = Math.max(0, currentNowPx - 180);
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(() => setCurrentNowPx(nowPx()), 60000);
    return () => clearInterval(id);
  }, []);

  function openNew(date?: Date, hour?: number) {
    const base = date ?? today;
    const start = new Date(base);
    start.setHours(hour ?? 9, 0, 0, 0);
    const end = new Date(start);
    end.setHours(end.getHours() + 1);
    setDraft({
      title: '',
      description: '',
      start: toDatetimeLocal(start),
      end: toDatetimeLocal(end),
      location: '',
      attendeesRaw: '',
      notes: '',
      status: 'scheduled',
    });
    setModal({ open: true, meeting: null });
  }

  function openEdit(m: Meeting) {
    setDraft({
      title: m.title,
      description: m.description ?? '',
      start: toDatetimeLocal(new Date(m.start)),
      end: toDatetimeLocal(new Date(m.end)),
      location: m.location ?? '',
      attendeesRaw: m.attendees.join(', '),
      notes: m.notes ?? '',
      status: m.status,
    });
    setModal({ open: true, meeting: m });
  }

  function field(k: keyof Draft, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    if (!draft.start || !draft.end) {
      toast.error('Start and end times required');
      return;
    }
    if (new Date(draft.end) <= new Date(draft.start)) {
      toast.error('End must be after start');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor: vendorId,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        start: new Date(draft.start).toISOString(),
        end: new Date(draft.end).toISOString(),
        location: draft.location.trim() || undefined,
        attendees: draft.attendeesRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: draft.notes.trim() || undefined,
        ...(modal.meeting ? { status: draft.status } : {}),
      };
      if (modal.meeting)
        await meetingService.update(modal.meeting._id, payload, token);
      else await meetingService.create(payload, token);
      toast.success(modal.meeting ? 'Meeting updated' : 'Meeting created');
      setModal({ open: false, meeting: null });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!modal.meeting) return;
    try {
      await meetingService.delete(modal.meeting._id, token);
      toast.success('Meeting deleted');
      setModal({ open: false, meeting: null });
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete');
    }
  }

  // Optimistic quick-status without full reload
  async function quickStatus(m: Meeting, s: Meeting['status']) {
    setMeetings((prev) =>
      prev.map((x) => (x._id === m._id ? { ...x, status: s } : x))
    );
    try {
      await meetingService.update(m._id, { status: s }, token);
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
      load(); // revert on error
    }
  }

  function toggleAttendee(name: string) {
    setActiveAttendees((prev) => {
      const next = new Set(prev);
      if (name === '__all__') return new Set(['__all__']);
      next.delete('__all__');
      if (next.has(name)) {
        next.delete(name);
        if (next.size === 0) return new Set(['__all__']);
      } else next.add(name);
      return next;
    });
  }

  if (loading && !vendor) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <PiSpinnerGap className="h-8 w-8 animate-spin text-[#b20202]" />
          <p className="text-sm text-gray-400">Loading meetings…</p>
        </div>
      </div>
    );
  }

  const weekLabel = `${MONTH_SHORT[weekStart.getMonth()]} ${weekStart.getDate()} – ${MONTH_SHORT[weekEnd.getMonth()]} ${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
  const weekStats = {
    scheduled: weekMeetings.filter((m) => m.status === 'scheduled').length,
    done: weekMeetings.filter((m) => m.status === 'done').length,
    cancelled: weekMeetings.filter((m) => m.status === 'cancelled').length,
  };

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col overflow-hidden bg-white">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-5 py-2.5">
        <nav className="flex items-center gap-1 text-xs">
          <Link
            href="/purchases/vendors"
            className="font-medium text-[#b20202] hover:text-[#7a0000]"
          >
            Vendors
          </Link>
          <PiCaretRight className="h-3 w-3 text-gray-300" />
          <Link
            href={`/purchases/vendors/${vendorId}`}
            className="font-medium text-[#b20202] hover:text-[#7a0000]"
          >
            {vendor?.name ?? '…'}
          </Link>
          <PiCaretRight className="h-3 w-3 text-gray-300" />
          <span className="font-semibold text-gray-700">Meetings</span>
        </nav>

        <div className="flex-1" />

        {viewMode === 'week' && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart((s) => addDays(s, -7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <PiArrowLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => {
                setWeekStart(getWeekStart(new Date()));
                setSelectedDate(new Date());
              }}
              className="rounded-lg border border-gray-200 px-3 py-1 text-[11px] font-bold text-gray-600 hover:bg-gray-50"
            >
              Today
            </button>
            <button
              onClick={() => setWeekStart((s) => addDays(s, 7))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <PiArrowRight className="h-3.5 w-3.5" />
            </button>
            <span className="ml-1 text-xs font-semibold text-gray-600">
              {weekLabel}
            </span>
          </div>
        )}

        <div className="flex gap-0.5 overflow-hidden rounded-lg border border-gray-200 bg-gray-50 p-0.5">
          {(['week', 'list'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all ${viewMode === v ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
            >
              {v === 'week' ? (
                <PiSquaresFour className="h-3.5 w-3.5" />
              ) : (
                <PiList className="h-3.5 w-3.5" />
              )}
              {v === 'week' ? 'Week' : 'List'}
            </button>
          ))}
        </div>

        <button
          onClick={() => openNew()}
          className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#950202] active:scale-95"
        >
          <PiPlus className="h-3.5 w-3.5" /> New Meeting
        </button>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Main content */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {viewMode === 'week' ? (
            <>
              {/* Day headers */}
              <div className="flex shrink-0 border-b border-gray-200 bg-white">
                <div className="w-14 shrink-0" />
                {weekDays.map((day, i) => {
                  const isToday = isSameDay(day, today);
                  const dayMs = visibleMeetings.filter((m) =>
                    isSameDay(new Date(m.start), day)
                  );
                  return (
                    <div
                      key={i}
                      className={`flex flex-1 flex-col items-center border-r border-gray-100 py-2.5 ${isToday ? 'bg-[#b20202]/[0.02]' : ''}`}
                    >
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest ${isToday ? 'text-[#b20202]' : 'text-gray-400'}`}
                      >
                        {DAY_NAMES[day.getDay()]}
                      </span>
                      <button
                        onClick={() => {
                          setSelectedDate(day);
                          setWeekStart(getWeekStart(day));
                        }}
                        className={`mt-1 flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-black transition-all ${isToday ? 'bg-[#b20202] text-white shadow-md shadow-[#b20202]/30' : 'text-gray-700 hover:bg-gray-100'}`}
                      >
                        {day.getDate()}
                      </button>
                      <div className="mt-1 flex h-1.5 items-center justify-center gap-0.5">
                        {dayMs.slice(0, 3).map((m, mi) => (
                          <span
                            key={mi}
                            className={`h-1.5 w-1.5 rounded-full ${pal(m.title).bg}`}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Time grid */}
              <div ref={gridRef} className="flex flex-1 overflow-y-auto">
                {/* Hour labels */}
                <div className="w-14 shrink-0 select-none bg-white">
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      style={{ height: HOUR_PX }}
                      className="relative border-b border-gray-100"
                    >
                      {h > 0 && (
                        <span className="absolute -top-2.5 right-2.5 text-[9px] font-medium text-gray-400">
                          {h < 12
                            ? `${h}am`
                            : h === 12
                              ? '12pm'
                              : `${h - 12}pm`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {/* Day columns */}
                {weekDays.map((day, di) => {
                  const isToday = isSameDay(day, today);
                  const dayMs = visibleMeetings.filter((m) =>
                    isSameDay(new Date(m.start), day)
                  );
                  return (
                    <div
                      key={di}
                      className={`relative flex-1 border-r border-gray-100 ${isToday ? 'bg-[#b20202]/[0.012]' : ''}`}
                    >
                      {HOURS.map((h) => (
                        <div
                          key={h}
                          style={{ height: HOUR_PX }}
                          className={`group/cell cursor-pointer border-b border-gray-100 transition-colors hover:bg-blue-50/40 ${h < 8 || h >= 20 ? 'bg-gray-50/40' : ''}`}
                          onClick={() => openNew(day, h)}
                        >
                          <span className="invisible ml-1 mt-0.5 block text-[9px] text-gray-300 group-hover/cell:visible">
                            {h < 12
                              ? `${h}:00am`
                              : h === 12
                                ? '12:00pm'
                                : `${h - 12}:00pm`}
                          </span>
                        </div>
                      ))}

                      {/* Now indicator */}
                      {isToday && (
                        <div
                          className="pointer-events-none absolute left-0 right-0 z-10"
                          style={{ top: currentNowPx }}
                        >
                          <div className="absolute -left-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[#b20202] shadow-sm" />
                          <div className="h-px bg-[#b20202]/70" />
                        </div>
                      )}

                      {/* Events */}
                      {dayMs.map((m) => {
                        const { top, height } = getEventStyle(m);
                        const p = pal(m.title);
                        const isCancelled = m.status === 'cancelled';
                        const isDone = m.status === 'done';
                        return (
                          <button
                            key={m._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              openEdit(m);
                            }}
                            className={`group/ev absolute inset-x-0.5 z-20 overflow-hidden rounded-lg border-l-[3px] px-2 py-1 text-left shadow-sm transition-all hover:z-30 hover:shadow-md hover:brightness-95 ${p.light} ${p.border} ${isCancelled ? 'opacity-40' : isDone ? 'opacity-60' : ''}`}
                            style={{
                              top: top + 1,
                              height: Math.max(22, height - 2),
                            }}
                          >
                            <p
                              className={`truncate text-[11px] font-bold leading-tight ${p.text} ${isDone ? 'line-through' : ''}`}
                            >
                              {m.title}
                            </p>
                            {height > 38 && (
                              <p
                                className={`truncate text-[10px] ${p.text} opacity-70`}
                              >
                                {fmtTime(new Date(m.start))} ·{' '}
                                {fmtDuration(
                                  new Date(m.start),
                                  new Date(m.end)
                                )}
                              </p>
                            )}
                            {height > 58 && m.location && (
                              <p
                                className={`truncate text-[10px] ${p.text} opacity-55`}
                              >
                                {m.location}
                              </p>
                            )}
                            {/* Quick-done hover button */}
                            {!isCancelled && !isDone && height > 38 && (
                              <div className="absolute right-1 top-1 hidden group-hover/ev:flex">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    quickStatus(m, 'done');
                                  }}
                                  className="flex h-4 w-4 items-center justify-center rounded bg-emerald-500 text-white shadow-sm"
                                  title="Mark as done"
                                >
                                  <PiCheck className="h-2.5 w-2.5" />
                                </button>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            /* List view */
            <div className="flex-1 overflow-y-auto bg-gray-50/40">
              {sortedVisible.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-24">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
                    <PiCalendarBlank className="h-8 w-8 text-gray-300" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-500">
                      No meetings yet
                    </p>
                    <p className="mt-1 text-xs text-gray-400">
                      Schedule the first meeting with this vendor
                    </p>
                  </div>
                  <button
                    onClick={() => openNew()}
                    className="flex items-center gap-1.5 rounded-lg bg-[#b20202] px-4 py-2 text-xs font-bold text-white hover:bg-[#950202]"
                  >
                    <PiPlus className="h-3.5 w-3.5" /> Schedule meeting
                  </button>
                </div>
              ) : (
                <div className="mx-auto max-w-2xl space-y-6 p-5">
                  {groupedMeetings.map(({ k, label, items, isPast }) => (
                    <div key={k}>
                      <div className="mb-2.5 flex items-center gap-2.5">
                        <span
                          className={`text-xs font-bold ${isPast ? 'text-gray-400' : 'text-gray-800'}`}
                        >
                          {label}
                        </span>
                        <div className="h-px flex-1 bg-gray-200" />
                      </div>
                      <div className="space-y-2">
                        {items.map((m) => {
                          const p = pal(m.title);
                          return (
                            <button
                              key={m._id}
                              onClick={() => openEdit(m)}
                              className="group flex w-full items-start gap-3.5 rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition-all hover:border-gray-300 hover:shadow-md"
                            >
                              <div
                                className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${p.bg}`}
                              >
                                <PiCalendarBlank className="h-4 w-4 text-white" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <p
                                    className={`text-sm font-bold text-gray-800 ${m.status === 'done' ? 'text-gray-400 line-through' : ''}`}
                                  >
                                    {m.title}
                                  </p>
                                  <span
                                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${m.status === 'done' ? 'bg-emerald-100 text-emerald-600' : m.status === 'cancelled' ? 'bg-gray-100 text-gray-400' : 'bg-blue-100 text-blue-600'}`}
                                  >
                                    {m.status}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                  <span>
                                    {fmtTime(new Date(m.start))} –{' '}
                                    {fmtTime(new Date(m.end))}
                                  </span>
                                  <span className="text-gray-300">·</span>
                                  <span>
                                    {fmtDuration(
                                      new Date(m.start),
                                      new Date(m.end)
                                    )}
                                  </span>
                                  {m.location && (
                                    <>
                                      <span className="text-gray-300">·</span>
                                      <span className="flex items-center gap-1">
                                        <PiMapPin className="h-3 w-3" />
                                        {m.location}
                                      </span>
                                    </>
                                  )}
                                </div>
                                {m.description && (
                                  <p className="mt-1 truncate text-xs text-gray-400">
                                    {m.description}
                                  </p>
                                )}
                                {m.attendees.length > 0 && (
                                  <div className="mt-2 flex items-center gap-1.5">
                                    <div className="flex -space-x-1.5">
                                      {m.attendees.slice(0, 5).map((a, i) => (
                                        <div
                                          key={i}
                                          className={`flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[8px] font-bold text-white ${pal(a).bg}`}
                                          title={a}
                                        >
                                          {ini(a)}
                                        </div>
                                      ))}
                                    </div>
                                    {m.attendees.length > 5 && (
                                      <span className="text-[10px] text-gray-400">
                                        +{m.attendees.length - 5} more
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar ────────────────────────────────────────────── */}
        <div className="w-60 shrink-0 overflow-y-auto border-l border-gray-200 bg-white">
          {/* Mini calendar */}
          <MiniCalendar
            selected={selectedDate}
            meetingDates={meetingDates}
            onChange={(d) => {
              setSelectedDate(d);
              setWeekStart(getWeekStart(d));
            }}
          />

          {/* This week stats */}
          <div className="border-t border-gray-100 px-3 py-3.5">
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              This Week
            </p>
            <div className="space-y-2.5">
              {[
                {
                  label: 'Scheduled',
                  val: weekStats.scheduled,
                  barCls: 'bg-blue-500',
                },
                {
                  label: 'Done',
                  val: weekStats.done,
                  barCls: 'bg-emerald-500',
                },
                {
                  label: 'Cancelled',
                  val: weekStats.cancelled,
                  barCls: 'bg-gray-300',
                },
              ].map(({ label, val, barCls }) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-[60px] shrink-0 text-xs text-gray-500">
                    {label}
                  </span>
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${barCls}`}
                      style={{
                        width: `${weekMeetings.length > 0 ? (val / weekMeetings.length) * 100 : 0}%`,
                      }}
                    />
                  </div>
                  <span className="w-4 text-right text-xs font-bold text-gray-700">
                    {val}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Attendee filter */}
          <div className="border-t border-gray-100 px-3 py-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Filter by Attendee
            </p>
            <div className="space-y-0.5">
              <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50">
                <div
                  onClick={() => toggleAttendee('__all__')}
                  className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${activeAttendees.has('__all__') ? 'border-[#b20202] bg-[#b20202]' : 'border-gray-300'}`}
                >
                  {activeAttendees.has('__all__') && (
                    <PiCheck className="h-2.5 w-2.5 text-white" />
                  )}
                </div>
                <span className="text-xs font-semibold text-gray-700">
                  Everyone
                </span>
              </label>
              {allAttendees.map((name) => {
                const checked = activeAttendees.has(name);
                const p = pal(name);
                return (
                  <label
                    key={name}
                    className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-gray-50"
                  >
                    <div
                      onClick={() => toggleAttendee(name)}
                      className={`flex h-4 w-4 items-center justify-center rounded border-2 transition-colors ${checked ? `border-transparent ${p.bg}` : 'border-gray-300'}`}
                    >
                      {checked && (
                        <PiCheck className="h-2.5 w-2.5 text-white" />
                      )}
                    </div>
                    <div
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${p.bg}`}
                    >
                      {ini(name)}
                    </div>
                    <span
                      className="flex-1 truncate text-xs text-gray-600"
                      title={name}
                    >
                      {name}
                    </span>
                  </label>
                );
              })}
              {allAttendees.length === 0 && (
                <p className="px-2 py-1 text-[11px] text-gray-400">
                  No attendees yet
                </p>
              )}
            </div>
          </div>

          {/* Quick schedule */}
          <div className="border-t border-gray-100 px-3 py-3">
            <button
              onClick={() => openNew()}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-gray-200 py-2 text-xs font-semibold text-gray-400 transition-colors hover:border-[#b20202]/40 hover:bg-[#b20202]/5 hover:text-[#b20202]"
            >
              <PiPlus className="h-3.5 w-3.5" /> Schedule Meeting
            </button>
          </div>
        </div>
      </div>

      {modal.open && (
        <MeetingModal
          draft={draft}
          onField={field}
          onSave={handleSave}
          onClose={() => setModal({ open: false, meeting: null })}
          onDelete={modal.meeting ? handleDelete : undefined}
          saving={saving}
          isEdit={!!modal.meeting}
        />
      )}
    </div>
  );
}
