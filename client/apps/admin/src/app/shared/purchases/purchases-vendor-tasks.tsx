'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import {
  PiArrowLeft,
  PiPlus,
  PiX,
  PiSpinnerGap,
  PiCheck,
  PiTrash,
  PiBuildings,
  PiMagnifyingGlass,
  PiClipboardText,
  PiWarning,
  PiCalendarBlank,
  PiCircle,
  PiCheckCircle,
  PiProhibit,
  PiHourglass,
  PiArrowClockwise,
  PiCaretDown,
  PiArrowsDownUp,
  PiSquaresFour,
  PiListBullets,
} from 'react-icons/pi';
import toast from 'react-hot-toast';
import { taskService } from '@/services/task.service';
import type { Task, TaskStatus, TaskPriority } from '@/services/task.service';
import { vendorService } from '@/services/vendor.service';
import type { Vendor } from '@/services/vendor.service';

// ─── Types ────────────────────────────────────────────────────────
type IconComp = React.ComponentType<{ className?: string }>;

// ─── Config ───────────────────────────────────────────────────────
const STATUS_CFG: Record<
  TaskStatus,
  {
    label: string;
    Icon: IconComp;
    bg: string;
    text: string;
    dot: string;
    colBg: string;
    dropBorder: string;
  }
> = {
  todo: {
    label: 'To Do',
    Icon: PiCircle,
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    colBg: 'bg-slate-50/60',
    dropBorder: 'border-slate-400',
  },
  in_progress: {
    label: 'In Progress',
    Icon: PiHourglass,
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    colBg: 'bg-blue-50/40',
    dropBorder: 'border-blue-400',
  },
  done: {
    label: 'Done',
    Icon: PiCheckCircle,
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-400',
    colBg: 'bg-emerald-50/30',
    dropBorder: 'border-emerald-400',
  },
  cancelled: {
    label: 'Cancelled',
    Icon: PiProhibit,
    bg: 'bg-gray-100',
    text: 'text-gray-500',
    dot: 'bg-gray-400',
    colBg: 'bg-gray-50/50',
    dropBorder: 'border-gray-400',
  },
};

const PRIORITY_CFG: Record<
  TaskPriority,
  {
    label: string;
    stripe: string;
    dot: string;
    badge: string;
    rank: number;
  }
> = {
  low: {
    label: 'Low',
    stripe: '#94a3b8',
    dot: 'bg-slate-400',
    badge: 'bg-slate-100 text-slate-500',
    rank: 0,
  },
  medium: {
    label: 'Medium',
    stripe: '#3b82f6',
    dot: 'bg-blue-400',
    badge: 'bg-blue-50 text-blue-600',
    rank: 1,
  },
  high: {
    label: 'High',
    stripe: '#f59e0b',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700',
    rank: 2,
  },
  urgent: {
    label: 'Urgent',
    stripe: '#b20202',
    dot: 'bg-red-600',
    badge: 'bg-red-50 text-[#b20202]',
    rank: 3,
  },
};

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done', 'cancelled'];
const PRIORITY_ORDER: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];
const NEXT_STATUS: Partial<Record<TaskStatus, TaskStatus>> = {
  todo: 'in_progress',
  in_progress: 'done',
};

// ─── Helpers ──────────────────────────────────────────────────────
function daysDiff(isoDate: string): number {
  const d = new Date(isoDate);
  const n = new Date();
  d.setHours(0, 0, 0, 0);
  n.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - n.getTime()) / 86_400_000);
}

function getDueMeta(task: Task) {
  if (!task.dueDate || task.status === 'done' || task.status === 'cancelled')
    return null;
  const diff = daysDiff(task.dueDate);
  if (diff < 0)
    return {
      label: `${-diff}d overdue`,
      cls: 'bg-red-50 text-red-600',
      urgent: true,
    };
  if (diff === 0)
    return {
      label: 'Due today',
      cls: 'bg-amber-50 text-amber-700',
      urgent: true,
    };
  if (diff === 1)
    return {
      label: 'Tomorrow',
      cls: 'bg-amber-50/70 text-amber-600',
      urgent: false,
    };
  return {
    label: new Date(task.dueDate).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
    }),
    cls: 'bg-gray-100 text-gray-500',
    urgent: false,
  };
}

function initials(name?: string): string {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ─── Draft ────────────────────────────────────────────────────────
interface Draft {
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string;
  assignedTo: string;
  tagsRaw: string;
  notes: string;
}
const emptyDraft = (status: TaskStatus = 'todo'): Draft => ({
  title: '',
  description: '',
  status,
  priority: 'medium',
  dueDate: '',
  assignedTo: '',
  tagsRaw: '',
  notes: '',
});
const taskToDraft = (t: Task): Draft => ({
  title: t.title,
  description: t.description ?? '',
  status: t.status,
  priority: t.priority,
  dueDate: t.dueDate ? t.dueDate.slice(0, 10) : '',
  assignedTo: t.assignedTo ?? '',
  tagsRaw: t.tags.join(', '),
  notes: t.notes ?? '',
});

// ─── Task Modal ────────────────────────────────────────────────────
function TaskModal({
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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-10">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-[500px] overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/10">
        {/* Dark header */}
        <div
          className="relative overflow-hidden px-6 pb-5 pt-5"
          style={{
            background:
              'linear-gradient(135deg, #0d0d0d 0%, #1a0606 60%, #0d0d0d 100%)',
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '18px 18px',
            }}
          />
          <div className="relative flex items-start gap-3">
            <div className="flex-1">
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">
                {isEdit ? 'Edit Task' : 'New Task'}
              </div>
              <input
                value={draft.title}
                onChange={(e) => onField('title', e.target.value)}
                placeholder="Task title…"
                autoFocus
                className="w-full border-0 bg-transparent text-[15px] font-extrabold leading-tight text-white placeholder-white/20 focus:outline-none"
              />
            </div>
            <button
              onClick={onClose}
              className="mt-0.5 shrink-0 text-white/30 transition-colors hover:text-white"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>

          {/* Priority stripe preview */}
          <div className="relative mt-3 h-[3px] w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full transition-all duration-200"
              style={{
                width: '100%',
                backgroundColor: PRIORITY_CFG[draft.priority].stripe,
              }}
            />
          </div>

          {/* Status + priority selectors */}
          <div className="relative mt-4 space-y-2">
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 w-11 text-[10px] text-gray-500">
                Status
              </span>
              {STATUS_ORDER.map((s) => {
                const cfg = STATUS_CFG[s];
                const active = draft.status === s;
                return (
                  <button
                    key={s}
                    onClick={() => onField('status', s)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.text}`
                        : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <span className="mr-1 w-11 text-[10px] text-gray-500">
                Priority
              </span>
              {PRIORITY_ORDER.map((p) => {
                const cfg = PRIORITY_CFG[p];
                const active = draft.priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => onField('priority', p)}
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition-all ${
                      active
                        ? cfg.badge
                        : 'bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/70'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="space-y-4 p-6">
          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Description
            </label>
            <textarea
              value={draft.description}
              onChange={(e) => onField('description', e.target.value)}
              rows={3}
              placeholder="What needs to be done?"
              className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Due Date
              </label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => onField('dueDate', e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm text-gray-700 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
                Assigned To
              </label>
              <input
                value={draft.assignedTo}
                onChange={(e) => onField('assignedTo', e.target.value)}
                placeholder="Name or email"
                className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Tags
            </label>
            <input
              value={draft.tagsRaw}
              onChange={(e) => onField('tagsRaw', e.target.value)}
              placeholder="pricing, follow-up, delivery (comma-separated)"
              className="w-full rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Notes
            </label>
            <textarea
              value={draft.notes}
              onChange={(e) => onField('notes', e.target.value)}
              rows={2}
              placeholder="Additional context or instructions…"
              className="w-full resize-none rounded-xl border border-gray-200 px-3.5 py-2.5 text-sm placeholder-gray-300 focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4">
          {isEdit && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-red-500">
                  Delete this task?
                </span>
                <button
                  onClick={onDelete}
                  className="rounded-lg bg-red-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-600"
                >
                  Yes, delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
              >
                <PiTrash className="h-3.5 w-3.5" /> Delete task
              </button>
            )
          ) : (
            <div />
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-600 transition-colors hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-xl bg-[#b20202] px-5 py-2 text-xs font-bold text-white transition-colors hover:bg-[#950202] disabled:opacity-60"
            >
              {saving ? (
                <PiSpinnerGap className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <PiCheck className="h-3.5 w-3.5" />
              )}
              {isEdit ? 'Save changes' : 'Create task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Task Card ─────────────────────────────────────────────────────
function TaskCard({
  task,
  dragging,
  onEdit,
  onCycleStatus,
  onQuickStatus,
}: {
  task: Task;
  dragging: boolean;
  onEdit: (t: Task) => void;
  onCycleStatus: (t: Task) => void;
  onQuickStatus: (t: Task, s: TaskStatus) => void;
}) {
  const priCfg = PRIORITY_CFG[task.priority];
  const stCfg = STATUS_CFG[task.status];
  const due = getDueMeta(task);
  const isDone = task.status === 'done';
  const isCan = task.status === 'cancelled';
  const canAct = !isDone && !isCan;

  return (
    <div
      className={`group relative overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/[0.06] transition-all duration-150 ${dragging ? 'scale-95 opacity-25 shadow-none' : 'hover:-translate-y-px hover:shadow-md'} ${isCan ? 'opacity-55' : ''} cursor-grab active:cursor-grabbing`}
    >
      {/* Priority top stripe */}
      <div
        className="h-[3px] w-full"
        style={{ backgroundColor: priCfg.stripe }}
      />

      <div className="p-3.5">
        {/* Title row */}
        <div className="flex items-start gap-2">
          {/* Clickable status icon — cycles to next status */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCycleStatus(task);
            }}
            title={
              canAct
                ? `Advance to ${NEXT_STATUS[task.status] ?? 'done'}`
                : stCfg.label
            }
            className={`mt-[1px] shrink-0 transition-colors ${stCfg.text} ${canAct ? 'hover:text-[#b20202]' : 'cursor-default'}`}
          >
            <stCfg.Icon className="h-3.5 w-3.5" />
          </button>

          <button className="flex-1 text-left" onClick={() => onEdit(task)}>
            <p
              className={`text-[13px] font-semibold leading-snug ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}
            >
              {task.title}
            </p>
            {task.description && (
              <p className="mt-0.5 line-clamp-1 text-[11px] leading-relaxed text-gray-400">
                {task.description}
              </p>
            )}
          </button>
        </div>

        {/* Meta row */}
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {due && (
              <span
                className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${due.cls}`}
              >
                {due.urgent ? (
                  <PiWarning className="h-3 w-3" />
                ) : (
                  <PiCalendarBlank className="h-3 w-3" />
                )}
                {due.label}
              </span>
            )}
            {task.tags.slice(0, 2).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500"
              >
                {tag}
              </span>
            ))}
            {task.tags.length > 2 && (
              <span className="text-[10px] text-gray-400">
                +{task.tags.length - 2}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {task.assignedTo && (
              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[9px] font-black text-gray-600">
                {initials(task.assignedTo)}
              </div>
            )}
            <span
              className={`rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wide ${priCfg.badge}`}
            >
              {task.priority[0].toUpperCase()}
            </span>
          </div>
        </div>

        {/* Hover quick actions */}
        {canAct && (
          <div className="absolute inset-x-3 bottom-2.5 hidden items-center justify-end gap-1 group-hover:flex">
            {task.status !== 'in_progress' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onQuickStatus(task, 'in_progress');
                }}
                className="flex items-center gap-1 rounded-md bg-blue-500 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-blue-600"
              >
                <PiHourglass className="h-3 w-3" /> Start
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onQuickStatus(task, 'done');
              }}
              className="flex items-center gap-1 rounded-md bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white transition hover:bg-emerald-600"
            >
              <PiCheck className="h-3 w-3" /> Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────
export default function PurchasesVendorTasks({
  vendorId,
}: {
  vendorId: string;
}) {
  const { data: session, status: authStatus } = useSession();
  const token = (session?.user as { token?: string })?.token ?? '';

  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [view, setView] = useState<'board' | 'list'>('board');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'created'>(
    'dueDate'
  );
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropCol, setDropCol] = useState<TaskStatus | null>(null);
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(new Set());
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({
    open: false,
    task: null,
  });
  const [draft, setDraft] = useState<Draft>(emptyDraft());

  // ── Data ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (authStatus === 'loading' || !token) return;
    setLoading(true);
    try {
      const [v, ts] = await Promise.all([
        vendorService.getById(vendorId, token),
        taskService.getAll(token, { vendor: vendorId }),
      ]);
      setVendor(v);
      setTasks(ts);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [vendorId, token, authStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const kpis = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return {
      open: tasks.filter((t) => t.status === 'todo').length,
      active: tasks.filter((t) => t.status === 'in_progress').length,
      done: tasks.filter((t) => t.status === 'done').length,
      cancelled: tasks.filter((t) => t.status === 'cancelled').length,
      overdue: tasks.filter((t) => {
        if (!t.dueDate || t.status === 'done' || t.status === 'cancelled')
          return false;
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        return d < now;
      }).length,
      dueToday: tasks.filter((t) => {
        if (!t.dueDate || t.status === 'done' || t.status === 'cancelled')
          return false;
        const d = new Date(t.dueDate);
        d.setHours(0, 0, 0, 0);
        return d.getTime() === now.getTime();
      }).length,
    };
  }, [tasks]);

  const displayed = useMemo(() => {
    let list = [...tasks];
    if (statusFilter !== 'all')
      list = list.filter((t) => t.status === statusFilter);
    if (priorityFilter !== 'all')
      list = list.filter((t) => t.priority === priorityFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description ?? '').toLowerCase().includes(q) ||
          (t.assignedTo ?? '').toLowerCase().includes(q) ||
          t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    }
    return list.sort((a, b) => {
      if (sortBy === 'priority')
        return PRIORITY_CFG[b.priority].rank - PRIORITY_CFG[a.priority].rank;
      if (sortBy === 'dueDate') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return (
        new Date(b.createdAt ?? 0).getTime() -
        new Date(a.createdAt ?? 0).getTime()
      );
    });
  }, [tasks, statusFilter, priorityFilter, search, sortBy]);

  const columns = useMemo(
    () =>
      STATUS_ORDER.map((s) => ({
        status: s,
        cfg: STATUS_CFG[s],
        tasks: displayed.filter((t) => t.status === s),
      })),
    [displayed]
  );

  // ── Actions ───────────────────────────────────────────────────────
  function openNew(defaultStatus: TaskStatus = 'todo') {
    setDraft(emptyDraft(defaultStatus));
    setModal({ open: true, task: null });
  }
  function openEdit(t: Task) {
    setDraft(taskToDraft(t));
    setModal({ open: true, task: t });
  }
  function field(k: keyof Draft, v: string) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    if (!draft.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        vendor: vendorId,
        title: draft.title.trim(),
        description: draft.description.trim() || undefined,
        status: draft.status,
        priority: draft.priority,
        dueDate: draft.dueDate || undefined,
        assignedTo: draft.assignedTo.trim() || undefined,
        tags: draft.tagsRaw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        notes: draft.notes.trim() || undefined,
      };
      if (modal.task) {
        const updated = await taskService.update(
          modal.task._id,
          payload,
          token
        );
        setTasks((prev) =>
          prev.map((t) => (t._id === updated._id ? updated : t))
        );
        toast.success('Task updated');
      } else {
        const created = await taskService.create(payload, token);
        setTasks((prev) => [created, ...prev]);
        toast.success('Task created');
      }
      setModal({ open: false, task: null });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!modal.task) return;
    try {
      await taskService.delete(modal.task._id, token);
      setTasks((prev) => prev.filter((t) => t._id !== modal.task!._id));
      toast.success('Task deleted');
      setModal({ open: false, task: null });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete');
    }
  }

  async function quickStatus(task: Task, s: TaskStatus) {
    setTasks((prev) =>
      prev.map((t) => (t._id === task._id ? { ...t, status: s } : t))
    );
    try {
      await taskService.update(task._id, { status: s }, token);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Update failed');
      load();
    }
  }

  function cycleStatus(task: Task) {
    const next = NEXT_STATUS[task.status];
    if (next) quickStatus(task, next);
  }

  // ── Drag & drop ───────────────────────────────────────────────────
  function onDragOver(e: React.DragEvent, s: TaskStatus) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropCol(s);
  }
  function onDragLeave(e: React.DragEvent) {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropCol(null);
  }
  function onDrop(e: React.DragEvent, s: TaskStatus) {
    e.preventDefault();
    if (dragId) {
      const task = tasks.find((t) => t._id === dragId);
      if (task && task.status !== s) quickStatus(task, s);
    }
    setDragId(null);
    setDropCol(null);
  }

  function toggleCollapse(s: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  }

  // ── Loading skeleton ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
        <div className="h-12 animate-pulse rounded-xl bg-gray-100" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-72 animate-pulse rounded-xl bg-gray-100"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Hero ── */}
      <div
        className="relative overflow-hidden rounded-2xl text-white shadow-xl"
        style={{
          background:
            'linear-gradient(135deg, #0d0d0d 0%, #1c0707 50%, #0d0d0d 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '22px 22px',
          }}
        />
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[#b20202]/10 blur-3xl" />

        <div className="relative px-7 py-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <Link
                href={`/purchases/vendors/${vendorId}`}
                className="mb-4 inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500 transition-colors hover:text-gray-300"
              >
                <PiArrowLeft className="h-3.5 w-3.5" />
                {vendor?.name ?? 'Vendor'}
              </Link>
              <div className="flex items-center gap-3.5">
                {vendor?.photo ? (
                  <img
                    src={vendor.photo}
                    alt=""
                    className="h-12 w-12 rounded-full object-cover ring-2 ring-white/15"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-2 ring-white/10">
                    <PiBuildings className="h-6 w-6 text-gray-400" />
                  </div>
                )}
                <div>
                  <h1 className="text-2xl font-black tracking-tight text-white">
                    {vendor?.name ?? '…'}
                  </h1>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-gray-500">
                    Task Board
                  </p>
                </div>
              </div>
            </div>

            {/* Big number */}
            <div className="text-right">
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-600">
                Open Tasks
              </div>
              <div className="mt-0.5 text-[52px] font-black tabular-nums leading-none text-white">
                {kpis.open + kpis.active}
              </div>
              <div className="mt-1 text-[11px] text-gray-500">
                {tasks.length} total · {kpis.done} done
              </div>
              {kpis.overdue > 0 && (
                <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-red-600/20 px-3 py-1 text-xs font-bold text-red-400 ring-1 ring-red-600/20">
                  <PiWarning className="h-3.5 w-3.5" />
                  {kpis.overdue} overdue
                </div>
              )}
            </div>
          </div>

          {/* Stats pills */}
          <div className="mt-5 flex flex-wrap items-center gap-1.5">
            {(
              [
                { label: 'To Do', val: kpis.open, dot: 'bg-slate-400' },
                { label: 'In Progress', val: kpis.active, dot: 'bg-blue-500' },
                { label: 'Done', val: kpis.done, dot: 'bg-emerald-400' },
                { label: 'Cancelled', val: kpis.cancelled, dot: 'bg-gray-500' },
                { label: 'Due Today', val: kpis.dueToday, dot: 'bg-amber-400' },
              ] as const
            ).map(({ label, val, dot }) => (
              <div
                key={label}
                className="flex items-center gap-1.5 rounded-full bg-white/5 px-3 py-1.5 ring-1 ring-white/5"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
                <span className="text-[11px] text-gray-400">{label}</span>
                <span className="text-[11px] font-black tabular-nums text-white">
                  {val}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[200px] flex-1">
          <PiMagnifyingGlass className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks, tags, assignee…"
            className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pl-8 pr-3 text-xs text-gray-700 placeholder-gray-300 transition-colors focus:border-[#b20202] focus:outline-none focus:ring-2 focus:ring-[#b20202]/10"
          />
        </div>

        {/* View toggle */}
        <div className="flex gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-1">
          {(
            [
              { id: 'board', Icon: PiSquaresFour, label: 'Board' },
              { id: 'list', Icon: PiListBullets, label: 'List' },
            ] as const
          ).map(({ id, Icon, label }) => (
            <button
              key={id}
              onClick={() => setView(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-bold transition-all ${
                view === id
                  ? 'bg-white text-gray-800 shadow-sm'
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {/* Status filter — only in list mode */}
        {view === 'list' && (
          <div className="flex gap-0.5 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(['all', ...STATUS_ORDER] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all ${
                  statusFilter === s
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_CFG[s].label}
              </button>
            ))}
          </div>
        )}

        <select
          value={priorityFilter}
          onChange={(e) =>
            setPriorityFilter(e.target.value as TaskPriority | 'all')
          }
          className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-xs text-gray-600 focus:border-[#b20202] focus:outline-none"
        >
          <option value="all">All priorities</option>
          {PRIORITY_ORDER.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_CFG[p].label}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2.5">
          <PiArrowsDownUp className="h-3.5 w-3.5 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="bg-transparent text-xs text-gray-600 focus:outline-none"
          >
            <option value="dueDate">By due date</option>
            <option value="priority">By priority</option>
            <option value="created">By newest</option>
          </select>
        </div>

        <button
          onClick={load}
          className="rounded-xl border border-gray-200 bg-white p-2.5 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          <PiArrowClockwise className="h-3.5 w-3.5" />
        </button>

        <button
          onClick={() => openNew()}
          className="flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#950202]"
        >
          <PiPlus className="h-3.5 w-3.5" /> New Task
        </button>
      </div>

      {/* ── Empty state ── */}
      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-white py-28 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
            <PiClipboardText className="h-8 w-8 text-gray-300" />
          </div>
          <p className="text-sm font-bold text-gray-700">No tasks yet</p>
          <p className="mt-1.5 text-xs text-gray-400">
            Create the first task for {vendor?.name ?? 'this vendor'}
          </p>
          <button
            onClick={() => openNew()}
            className="mt-6 flex items-center gap-1.5 rounded-xl bg-[#b20202] px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-[#950202]"
          >
            <PiPlus className="h-3.5 w-3.5" /> Create task
          </button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-16 text-center">
          <p className="text-sm font-bold text-gray-600">
            No tasks match your filters
          </p>
          <button
            onClick={() => {
              setStatusFilter('all');
              setPriorityFilter('all');
              setSearch('');
            }}
            className="mt-3 text-xs font-semibold text-[#b20202] hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : view === 'board' ? (
        /* ════ Board view ════ */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map(({ status: s, cfg, tasks: colTasks }) => {
            const isCollapsed = collapsed.has(s);
            const isDrop = dropCol === s;

            return (
              <div
                key={s}
                className={`flex flex-col gap-2 rounded-2xl border-2 p-3 transition-all duration-150 ${
                  isDrop
                    ? `border-dashed ${cfg.dropBorder} bg-white/90`
                    : `border-transparent ${cfg.colBg}`
                }`}
                onDragOver={(e) => onDragOver(e, s)}
                onDragLeave={onDragLeave}
                onDrop={(e) => onDrop(e, s)}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-0.5 py-0.5">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${cfg.dot}`} />
                    <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span
                      className={`min-w-[20px] rounded-full px-1.5 py-0.5 text-center text-[10px] font-black ${cfg.bg} ${cfg.text}`}
                    >
                      {colTasks.length}
                    </span>
                    <button
                      onClick={() => toggleCollapse(s)}
                      className="rounded p-0.5 text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-700"
                      title={isCollapsed ? 'Expand' : 'Collapse'}
                    >
                      <PiCaretDown
                        className={`h-3 w-3 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </button>
                  </div>
                </div>

                {/* Cards */}
                {!isCollapsed && (
                  <>
                    {colTasks.length > 0 ? (
                      <div className="flex flex-col gap-2">
                        {colTasks.map((task) => (
                          <div
                            key={task._id}
                            draggable
                            onDragStart={() => setDragId(task._id)}
                            onDragEnd={() => {
                              setDragId(null);
                              setDropCol(null);
                            }}
                          >
                            <TaskCard
                              task={task}
                              dragging={dragId === task._id}
                              onEdit={openEdit}
                              onCycleStatus={cycleStatus}
                              onQuickStatus={quickStatus}
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div
                        className={`rounded-xl border border-dashed py-5 text-center text-[11px] font-medium transition-colors ${
                          isDrop
                            ? 'border-gray-400 text-gray-400'
                            : 'border-gray-200 text-gray-300'
                        }`}
                      >
                        {isDrop ? 'Drop here' : 'No tasks'}
                      </div>
                    )}

                    <button
                      onClick={() => openNew(s)}
                      className="flex items-center gap-1.5 rounded-xl border border-dashed border-gray-200 px-3 py-2.5 text-[11px] font-semibold text-gray-400 transition-all hover:border-[#b20202]/40 hover:bg-[#b20202]/5 hover:text-[#b20202]"
                    >
                      <PiPlus className="h-3.5 w-3.5" /> Add task
                    </button>
                  </>
                )}

                {/* Collapsed summary row */}
                {isCollapsed && colTasks.length > 0 && (
                  <button
                    onClick={() => toggleCollapse(s)}
                    className="rounded-xl border border-dashed border-gray-200 py-2 text-center text-[11px] font-medium text-gray-400 transition-colors hover:text-gray-600"
                  >
                    Show {colTasks.length} task
                    {colTasks.length !== 1 ? 's' : ''}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        /* ════ List view ════ */
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {displayed.map((task, i) => {
            const priCfg = PRIORITY_CFG[task.priority];
            const stCfg = STATUS_CFG[task.status];
            const due = getDueMeta(task);
            const isDone = task.status === 'done';
            const isCan = task.status === 'cancelled';
            return (
              <div
                key={task._id}
                className={`group flex cursor-pointer items-center gap-3 px-5 py-3.5 transition-colors hover:bg-gray-50/80 ${
                  i > 0 ? 'border-t border-gray-100' : ''
                } ${isCan ? 'opacity-55' : ''}`}
                onClick={() => openEdit(task)}
              >
                {/* Priority stripe dot */}
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: priCfg.stripe }}
                />

                {/* Status icon (clickable to cycle) */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    cycleStatus(task);
                  }}
                  className={`shrink-0 transition-colors ${stCfg.text} hover:text-[#b20202]`}
                >
                  <stCfg.Icon className="h-3.5 w-3.5" />
                </button>

                {/* Title + description */}
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${isDone ? 'text-gray-400 line-through' : 'text-gray-800'}`}
                  >
                    {task.title}
                  </p>
                  {task.description && (
                    <p className="truncate text-xs text-gray-400">
                      {task.description}
                    </p>
                  )}
                </div>

                {/* Due badge */}
                {due && (
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${due.cls}`}
                  >
                    {due.label}
                  </span>
                )}

                {/* Assignee avatar */}
                {task.assignedTo && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200 text-[9px] font-black text-gray-600">
                    {initials(task.assignedTo)}
                  </div>
                )}

                {/* Tags (hidden on small screens) */}
                <div className="hidden items-center gap-1 sm:flex">
                  {task.tags.slice(0, 2).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Priority badge */}
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${priCfg.badge}`}
                >
                  {priCfg.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {modal.open && (
        <TaskModal
          draft={draft}
          onField={field}
          onSave={handleSave}
          onClose={() => setModal({ open: false, task: null })}
          onDelete={modal.task ? handleDelete : undefined}
          saving={saving}
          isEdit={!!modal.task}
        />
      )}
    </div>
  );
}
