'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  PiArrowRight,
  PiArchive,
  PiClipboardText,
  PiClock,
  PiCrown,
  PiNotePencil,
  PiUsersThree,
  PiStar,
} from 'react-icons/pi';
import type { AppraisalTemplateDoc, QuestionType } from '@/services/appraisal.service';
import { getTypeInfo } from './template-type-selector';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function questionCount(t: AppraisalTemplateDoc): number {
  return (t.sections || []).reduce(
    (sum, s) => sum + (s.questions || []).length,
    0
  );
}

function sectionCount(t: AppraisalTemplateDoc): number {
  return (t.sections || []).length;
}

function typeBreakdown(t: AppraisalTemplateDoc): Record<string, number> {
  const byType: Record<string, number> = {};
  (t.sections || []).forEach((s) =>
    (s.questions || []).forEach((q) => {
      byType[q.type] = (byType[q.type] || 0) + 1;
    })
  );
  return byType;
}

function audienceBreakdown(t: AppraisalTemplateDoc): {
  self: number;
  manager: number;
  peer: number;
} {
  const counts = { self: 0, manager: 0, peer: 0 };
  (t.sections || []).forEach((s) =>
    (s.questions || []).forEach((q) => {
      (q.askOf || []).forEach((k) => {
        counts[k] = (counts[k] || 0) + 1;
      });
    })
  );
  return counts;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

// ---------------------------------------------------------------------------
// Audience icons
// ---------------------------------------------------------------------------
const AUDIENCE_META = {
  self: { icon: PiNotePencil, label: 'Self', cls: 'text-gray-500' },
  manager: { icon: PiCrown, label: 'Manager', cls: 'text-purple-500' },
  peer: { icon: PiUsersThree, label: 'Peer', cls: 'text-blue-500' },
} as const;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TemplateListCardProps {
  template: AppraisalTemplateDoc;
  index: number;
  onArchive: (t: AppraisalTemplateDoc) => void;
  archiving: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TemplateListCard({
  template,
  index,
  onArchive,
  archiving,
}: TemplateListCardProps) {
  const t = template;
  const qc = questionCount(t);
  const sc = sectionCount(t);
  const types = typeBreakdown(t);
  const audiences = audienceBreakdown(t);
  const isArchiving = archiving === t._id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 26,
        delay: Math.min(index * 0.06, 0.4),
      }}
      className="group relative flex flex-col rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-gray-300 hover:shadow-md"
    >
      {/* Header row: icon + name + badges */}
      <div className="flex items-start gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#b20202]/10 text-[#b20202]">
          <PiClipboardText className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5">
            <h3 className="truncate text-sm font-semibold text-gray-900">
              {t.name}
            </h3>
            {t.isDefault ? (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-inset ring-amber-100">
                <PiStar className="h-3 w-3" />
                Default
              </span>
            ) : null}
          </div>
          {t.description ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-gray-500">
              {t.description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Stats row */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-gray-500 mb-3">
        <span className="inline-flex items-center gap-1">
          <span className="font-semibold text-gray-900">v{t.version}</span>
        </span>
        <span className="h-3 w-px bg-gray-200" />
        <span>
          <span className="font-semibold text-gray-900">{sc}</span>{' '}
          section{sc !== 1 ? 's' : ''}
        </span>
        <span className="h-3 w-px bg-gray-200" />
        <span>
          <span className="font-semibold text-gray-900">{qc}</span>{' '}
          question{qc !== 1 ? 's' : ''}
        </span>
        {t.updatedAt ? (
          <>
            <span className="h-3 w-px bg-gray-200" />
            <span className="inline-flex items-center gap-1">
              <PiClock className="h-3 w-3 text-gray-400" />
              {timeAgo(t.updatedAt)}
            </span>
          </>
        ) : null}
      </div>

      {/* Type breakdown */}
      {Object.keys(types).length > 0 ? (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {(Object.keys(types) as QuestionType[]).map((type) => {
            const info = getTypeInfo(type);
            return (
              <span
                key={type}
                className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${info.bg} ${info.color} ${info.ring}`}
              >
                <info.icon className="h-3 w-3" />
                {types[type]}
              </span>
            );
          })}
        </div>
      ) : null}

      {/* Audience row */}
      <div className="flex items-center gap-2 mb-4">
        {(Object.keys(audiences) as Array<keyof typeof audiences>).map((k) => {
          if (audiences[k] === 0) return null;
          const meta = AUDIENCE_META[k];
          const Icon = meta.icon;
          return (
            <span
              key={k}
              className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.cls}`}
              title={`${audiences[k]} ${meta.label} question${audiences[k] !== 1 ? 's' : ''}`}
            >
              <Icon className="h-3 w-3" />
              {audiences[k]}
            </span>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-gray-100 pt-3">
        <Link
          href={`/appraisals/templates/${t._id}`}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#b20202] px-3 py-2 text-xs font-semibold text-white shadow-sm shadow-[#b20202]/20 transition-all duration-200 hover:bg-[#9f0101] hover:shadow-md hover:shadow-[#b20202]/25"
        >
          Edit
          <PiArrowRight className="h-3.5 w-3.5" />
        </Link>
        {t.isDefault ? null : (
          <button
            type="button"
            onClick={() => onArchive(t)}
            disabled={isArchiving}
            title="Archive this template"
            className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 transition-all duration-200 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
          >
            <PiArchive className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </motion.div>
  );
}
