'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  PiChartBar,
  PiListChecks,
  PiListNumbers,
  PiTextAlignLeft,
  PiToggleLeft,
  PiTrophy,
} from 'react-icons/pi';
import type { DraftSection, QuestionType } from '@/services/appraisal.service';

// ---------------------------------------------------------------------------
// Type icons map
// ---------------------------------------------------------------------------
const TYPE_ICONS: Record<QuestionType, React.ComponentType<{ className?: string }>> = {
  rating: PiChartBar,
  likert: PiListNumbers,
  text: PiTextAlignLeft,
  choice: PiListChecks,
  yes_no: PiToggleLeft,
  scale: PiTrophy,
};

const TYPE_COLORS: Record<QuestionType, { bg: string; text: string; ring: string }> = {
  rating: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
  likert: { bg: 'bg-violet-50', text: 'text-violet-600', ring: 'ring-violet-100' },
  text: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
  choice: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
  yes_no: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  scale: { bg: 'bg-cyan-50', text: 'text-cyan-600', ring: 'ring-cyan-100' },
};

const TYPE_LABELS: Record<QuestionType, string> = {
  rating: 'Rating',
  likert: 'Likert',
  text: 'Text',
  choice: 'Choice',
  yes_no: 'Yes/No',
  scale: 'Scale',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
interface TemplateFormSummaryProps {
  sections: DraftSection[];
}

export default function TemplateFormSummary({ sections }: TemplateFormSummaryProps) {
  const stats = useMemo(() => {
    const allQuestions = sections.flatMap((s) => s.questions);
    const total = allQuestions.length;
    const byType: Record<string, number> = {};

    allQuestions.forEach((q) => {
      byType[q.type] = (byType[q.type] || 0) + 1;
    });

    const configured = allQuestions.filter(
      (q) => q.label.trim() && q.askOf.length > 0
    ).length;

    return { total, configured, byType, sectionCount: sections.length };
  }, [sections]);

  if (stats.total === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="rounded-2xl border border-gray-100 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-sm sm:px-5"
    >
      {/* Top row: stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900">{stats.sectionCount}</span>
          <span>section{stats.sectionCount !== 1 ? 's' : ''}</span>
        </div>

        <div className="h-3 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-gray-900">{stats.total}</span>
          <span>question{stats.total !== 1 ? 's' : ''}</span>
        </div>

        <div className="h-3 w-px bg-gray-200" />

        <div className="flex items-center gap-1.5">
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <span className="font-semibold text-emerald-600">{stats.configured}</span>
          <span className="text-gray-500">configured</span>
        </div>
      </div>

      {/* Bottom row: type breakdown */}
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        {(Object.keys(stats.byType) as QuestionType[]).map((type) => {
          const count = stats.byType[type];
          const Icon = TYPE_ICONS[type];
          const colors = TYPE_COLORS[type];
          return (
            <span
              key={type}
              title={`${count} ${TYPE_LABELS[type]} question${count !== 1 ? 's' : ''}`}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${colors.bg} ${colors.text} ${colors.ring}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {TYPE_LABELS[type]}
              <span className="opacity-60">{count}</span>
            </span>
          );
        })}
      </div>
    </motion.div>
  );
}
