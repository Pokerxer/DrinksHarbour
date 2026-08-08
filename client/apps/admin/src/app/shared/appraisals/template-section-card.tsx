'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from 'rizzui';
import {
  PiArrowDown,
  PiArrowUp,
  PiBuildings,
  PiCaretRight,
  PiPlusBold,
  PiSparkle,
  PiTrash,
} from 'react-icons/pi';
import type { DraftQuestion } from '@/services/appraisal.service';
import type { KeyedSection } from './template-draft-keys';
import TemplateQuestionRow from './template-question-row';
import {
  describeSectionAudience,
  toggleSectionDepartment,
  type DepartmentOption,
} from './section-departments-utils';

// ---------------------------------------------------------------------------
// Section-type hint
// ---------------------------------------------------------------------------
const SECTION_HINTS: Record<string, string> = {
  'Core Competencies': 'Rate key skills and behaviours specific to the role.',
  'Goal Assessment': 'Evaluate progress against goals and set new objectives.',
  'Strengths & Areas for Improvement':
    'Highlight strengths and identify development areas.',
  'Development Plan': 'Outline training needs and career aspirations.',
  'Leadership & Decision-Making':
    'Assess leadership capability and decision quality.',
  'Communication & Collaboration':
    'Rate communication effectiveness and teamwork.',
  'Technical & Role Competency':
    'Evaluate technical or role-specific skill proficiency.',
  'Culture & Values': 'Assess alignment with company values and culture.',
  'Top Accomplishments': 'Capture key achievements from the period.',
  'Goals Progress': 'Rate progress toward annual or quarterly goals.',
  'Challenges & Support': 'Identify barriers and needed resources.',
  'Next Quarter Focus': 'Set priorities for the upcoming quarter.',
  'Role Understanding & Performance':
    'Evaluate grasp of role and quality of output.',
  'Learning & Adaptability': 'Assess willingness to learn and adapt to change.',
  'Team & Culture Fit': 'Evaluate integration and cultural alignment.',
  'Overall Assessment':
    'Final summary: achievements, areas for growth, and recommendation.',
};

// ---------------------------------------------------------------------------
// Section color palette
// ---------------------------------------------------------------------------
const SECTION_COLORS = [
  { ring: 'ring-[#b20202]/20', bg: 'bg-[#b20202]', text: 'text-[#b20202]' },
  { ring: 'ring-purple-500/20', bg: 'bg-purple-500', text: 'text-purple-600' },
  {
    ring: 'ring-emerald-500/20',
    bg: 'bg-emerald-500',
    text: 'text-emerald-600',
  },
  { ring: 'ring-blue-500/20', bg: 'bg-blue-500', text: 'text-blue-600' },
  { ring: 'ring-amber-500/20', bg: 'bg-amber-500', text: 'text-amber-600' },
  { ring: 'ring-cyan-500/20', bg: 'bg-cyan-500', text: 'text-cyan-600' },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TemplateSectionCardProps {
  // Keyed rather than bare: this card renders each question with the
  // question's own client identity as its React key, so it needs `_uid`.
  section: KeyedSection;
  sectionIndex: number;
  isFirst: boolean;
  isLast: boolean;
  totalSections: number;
  hasBadField: boolean;
  saving: boolean;
  onTitleChange: (si: number, title: string) => void;
  onMove: (si: number, dir: -1 | 1) => void;
  onRemove: (si: number) => void;
  onAddQuestion: (si: number) => void;
  onPatchQuestion: (
    si: number,
    qi: number,
    patch: Partial<DraftQuestion>
  ) => void;
  onMoveQuestion: (si: number, qi: number, dir: -1 | 1) => void;
  onRemoveQuestion: (si: number, qi: number) => void;
  onDuplicateQuestion?: (si: number, qi: number) => void;
  /** Opens the AI modal pre-scoped to growing THIS section. */
  onExpandWithAi?: (si: number) => void;
  onAssistQuestion?: (
    si: number,
    qi: number,
    mode: 'label' | 'options' | 'askOf'
  ) => void;
  /** `${si}:${qi}` of the question whose assist is in flight, if any. */
  assistingKey?: string | null;
  /**
   * The tenant's departments, for the per-section scope picker (Phase 5 §9.1).
   * Empty (a tenant with no departments yet, or a still-loading list) hides the
   * picker entirely rather than showing a control with nothing in it.
   */
  departmentOptions?: DepartmentOption[];
  onDepartmentsChange?: (si: number, departments: string[]) => void;
}

export default function TemplateSectionCard({
  section,
  sectionIndex,
  isFirst,
  isLast,
  totalSections,
  hasBadField,
  saving,
  onTitleChange,
  onMove,
  onRemove,
  onAddQuestion,
  onPatchQuestion,
  onMoveQuestion,
  onRemoveQuestion,
  onDuplicateQuestion,
  onExpandWithAi,
  onAssistQuestion,
  assistingKey,
  departmentOptions = [],
  onDepartmentsChange,
}: TemplateSectionCardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [scopeOpen, setScopeOpen] = useState(false);
  const si = sectionIndex;
  const color = SECTION_COLORS[si % SECTION_COLORS.length];
  const hint = SECTION_HINTS[section.title.trim()] ?? undefined;
  const questionCount = section.questions.length;
  const answeredCount = section.questions.filter(
    (q) => q.label.trim() && q.askOf.length > 0
  ).length;
  const progressPct =
    questionCount > 0 ? Math.round((answeredCount / questionCount) * 100) : 0;
  const isComplete = answeredCount === questionCount && questionCount > 0;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        type: 'spring',
        stiffness: 260,
        damping: 26,
        delay: Math.min(si * 0.06, 0.3),
      }}
      className={`flex flex-col rounded-2xl border bg-white shadow-sm transition-all duration-200 ${
        hasBadField
          ? 'border-red-300 shadow-red-100'
          : 'border-gray-200 hover:shadow-md'
      }`}
    >
      {/* ─── Row 1: Section number + Title input + Progress ring ─── */}
      <div className="flex items-center gap-3 px-4 pb-2 pt-4 sm:px-5">
        {/* Section number badge */}
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${color.bg}/10 ring-1 ring-inset ${color.ring}`}
        >
          <span className={`text-sm font-bold ${color.text}`}>{si + 1}</span>
        </div>

        {/* Title input (takes remaining space) */}
        <div className="min-w-0 flex-1">
          <Input
            value={section.title}
            onChange={(e) => onTitleChange(si, e.target.value)}
            placeholder="Section title..."
            disabled={saving}
          />
        </div>

        {/* Progress ring */}
        {questionCount > 0 ? (
          <div className="relative h-10 w-10 shrink-0">
            <svg className="h-10 w-10 -rotate-90" viewBox="0 0 36 36">
              <circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="3"
              />
              <motion.circle
                cx="18"
                cy="18"
                r="15.5"
                fill="none"
                stroke={isComplete ? '#10b981' : '#b20202'}
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="97.39"
                initial={{ strokeDashoffset: 97.39 }}
                animate={{
                  strokeDashoffset: 97.39 - (97.39 * progressPct) / 100,
                }}
                transition={{ type: 'spring', stiffness: 60, damping: 15 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-600">
              {progressPct}%
            </span>
          </div>
        ) : null}
      </div>

      {/* ─── Row 1b: Who is asked this section (Phase 5 §9.1) ─── */}
      {departmentOptions.length > 0 && onDepartmentsChange ? (
        <div className="px-4 pb-2 sm:px-5">
          <button
            type="button"
            onClick={() => setScopeOpen((open) => !open)}
            disabled={saving}
            className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
              (section.departments || []).length === 0
                ? 'bg-gray-50 text-gray-600 ring-gray-200 hover:bg-gray-100'
                : `${color.bg}/10 ${color.text} ${color.ring} hover:brightness-95`
            }`}
          >
            <PiBuildings className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              Asked of: {describeSectionAudience(section.departments, departmentOptions)}
            </span>
          </button>

          <AnimatePresence initial={false}>
            {scopeOpen ? (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  {/* Said outright, because a multi-select with nothing ticked
                      normally means "nobody" and here it means the opposite. */}
                  <p className="mb-2 text-[11px] text-gray-500">
                    Tick none to ask this section of everyone. Tick one or more
                    and only employees in those departments are asked it.
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {departmentOptions.map((dept) => {
                      const on = (section.departments || []).includes(dept._id);
                      return (
                        <button
                          key={dept._id}
                          type="button"
                          disabled={saving}
                          onClick={() =>
                            onDepartmentsChange(
                              si,
                              toggleSectionDepartment(section.departments, dept._id)
                            )
                          }
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
                            on
                              ? 'bg-[#b20202] text-white ring-[#b20202]'
                              : 'bg-white text-gray-600 ring-gray-200 hover:bg-gray-100'
                          }`}
                        >
                          {dept.name}
                        </button>
                      );
                    })}
                  </div>
                  {(section.departments || []).length > 0 ? (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => onDepartmentsChange(si, [])}
                      className="mt-2 text-[11px] font-medium text-gray-500 underline underline-offset-2 hover:text-gray-700 disabled:opacity-50"
                    >
                      Ask everyone instead
                    </button>
                  ) : null}
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}

      {/* ─── Row 2: Collapse toggle + Label + Complete badge + Controls ─── */}
      <div className="flex items-center gap-2 px-4 pb-3 sm:px-5">
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
        >
          <motion.div
            animate={{ rotate: collapsed ? 0 : 90 }}
            transition={{ duration: 0.15 }}
          >
            <PiCaretRight className="h-4 w-4" />
          </motion.div>
        </button>

        <span className="text-[11px] font-medium text-gray-500">
          Section {si + 1} of {totalSections}
        </span>

        {isComplete ? (
          <motion.span
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 ring-1 ring-inset ring-emerald-100"
          >
            <svg
              className="h-3 w-3"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
            Complete
          </motion.span>
        ) : questionCount > 0 ? (
          <span className="text-[11px] text-gray-400">
            {answeredCount}/{questionCount} configured
          </span>
        ) : null}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Section controls */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label="Move section up"
            onClick={() => onMove(si, -1)}
            disabled={saving || isFirst}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <PiArrowUp className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Move section down"
            onClick={() => onMove(si, 1)}
            disabled={saving || isLast}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30"
          >
            <PiArrowDown className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label="Remove section"
            onClick={() => onRemove(si)}
            disabled={saving || totalSections === 1}
            className="rounded p-1.5 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
          >
            <PiTrash className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ─── Hint text ─── */}
      {hint ? (
        <div className="px-4 pb-2 sm:px-5">
          <p className="text-[11px] text-gray-400">{hint}</p>
        </div>
      ) : null}

      {/* ─── Progress bar ─── */}
      {questionCount > 0 && !isComplete ? (
        <div className="mx-4 h-1.5 overflow-hidden rounded-full bg-gray-100 sm:mx-5">
          <motion.div
            className={`h-full rounded-full ${progressPct > 0 ? 'bg-gradient-to-r from-[#b20202] to-[#d40404]' : 'bg-gray-200'}`}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 15 }}
          />
        </div>
      ) : null}

      {/* ─── Questions (collapsible) ─── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-2.5 px-4 pb-3 sm:px-5">
              <AnimatePresence mode="popLayout">
                {section.questions.map((q, qi) => (
                  <TemplateQuestionRow
                    // Client identity, not the index. The row owns `collapsed`
                    // and `assistOpen`, and this list sits inside an
                    // AnimatePresence — under index keys, deleting a question
                    // animated the LAST row out and left the survivors wearing
                    // their neighbours' open/closed state.
                    key={q._uid}
                    question={q}
                    sectionIndex={si}
                    questionIndex={qi}
                    isFirst={qi === 0}
                    isLast={qi === section.questions.length - 1}
                    hasBadField={false}
                    saving={saving}
                    onPatch={onPatchQuestion}
                    onMove={onMoveQuestion}
                    onRemove={onRemoveQuestion}
                    onDuplicate={onDuplicateQuestion}
                    onAssist={onAssistQuestion}
                    assisting={assistingKey === `${si}:${qi}`}
                  />
                ))}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Add question button ─── */}
      <div className="border-t border-gray-100 px-4 py-2.5 sm:px-5">
        <button
          type="button"
          onClick={() => {
            setCollapsed(false);
            onAddQuestion(si);
          }}
          disabled={saving}
          className="inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#b20202] opacity-70 transition-opacity hover:underline hover:opacity-100 disabled:opacity-50"
        >
          <PiPlusBold className="h-3.5 w-3.5" />
          Add question
        </button>
        {onExpandWithAi ? (
          <button
            type="button"
            onClick={() => {
              setCollapsed(false);
              onExpandWithAi(si);
            }}
            disabled={saving}
            className="ml-4 inline-flex w-fit items-center gap-1.5 text-sm font-semibold text-[#b20202] opacity-70 transition-opacity hover:underline hover:opacity-100 disabled:opacity-50"
          >
            <PiSparkle className="h-3.5 w-3.5" />
            Expand with AI
          </button>
        ) : null}
      </div>
    </motion.div>
  );
}
