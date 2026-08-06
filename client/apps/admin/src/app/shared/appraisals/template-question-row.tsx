'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Switch, Text } from 'rizzui';
import {
  PiArrowDown,
  PiArrowUp,
  PiCaretRight,
  PiCopy,
  PiDotsSixVertical,
  PiSparkle,
  PiTrash,
  PiWarningCircle,
} from 'react-icons/pi';
import type { DraftQuestion, FeedbackKind, QuestionType } from '@/services/appraisal.service';
import TemplateTypeSelector, { getTypeInfo } from './template-type-selector';
import TemplateQuestionConfig from './template-question-config';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const KINDS: { value: FeedbackKind; label: string }[] = [
  { value: 'self', label: 'Self' },
  { value: 'manager', label: 'Manager' },
  { value: 'peer', label: 'Peer' },
];

const ASSIST_ACTIONS: {
  mode: 'label' | 'options' | 'askOf';
  label: string;
  hint: string;
  /** Options only make sense on a choice question. */
  onlyChoice?: boolean;
}[] = [
  { mode: 'label', label: 'Rewrite the question', hint: 'Make it an observable behaviour' },
  { mode: 'options', label: 'Suggest answer options', hint: 'Replaces the current options', onlyChoice: true },
  { mode: 'askOf', label: 'Suggest who answers it', hint: 'Picks the reviewers who can judge it' },
];

const KIND_META: Record<FeedbackKind, { cls: string; ring: string }> = {
  self: { cls: 'bg-blue-50 text-blue-600', ring: 'ring-blue-100' },
  manager: { cls: 'bg-purple-50 text-purple-600', ring: 'ring-purple-100' },
  peer: { cls: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100' },
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface TemplateQuestionRowProps {
  question: DraftQuestion;
  sectionIndex: number;
  questionIndex: number;
  isFirst: boolean;
  isLast: boolean;
  hasBadField: boolean;
  saving: boolean;
  onPatch: (si: number, qi: number, patch: Partial<DraftQuestion>) => void;
  onMove: (si: number, qi: number, dir: -1 | 1) => void;
  onRemove: (si: number, qi: number) => void;
  onDuplicate?: (si: number, qi: number) => void;
  /**
   * Per-question AI assist. `mode` decides which keys the model may touch —
   * the server merges its proposal onto this question rather than replacing
   * it, so a label rewrite cannot flip the type or re-scope `askOf`.
   */
  onAssist?: (si: number, qi: number, mode: 'label' | 'options' | 'askOf') => void;
  /** True while this row's assist is in flight. */
  assisting?: boolean;
}

export default function TemplateQuestionRow({
  question,
  sectionIndex,
  questionIndex,
  isFirst,
  isLast,
  hasBadField,
  saving,
  onPatch,
  onMove,
  onRemove,
  onDuplicate,
  onAssist,
  assisting = false,
}: TemplateQuestionRowProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [assistOpen, setAssistOpen] = useState(false);
  const si = sectionIndex;
  const qi = questionIndex;
  const q = question;
  const typeInfo = getTypeInfo(q.type);
  const answeredCount = q.askOf.length;
  const isComplete = q.label.trim() && answeredCount > 0;

  function patch(p: Partial<DraftQuestion>) {
    onPatch(si, qi, p);
  }

  function toggleAskOf(kind: FeedbackKind) {
    const next = q.askOf.includes(kind)
      ? q.askOf.filter((k) => k !== kind)
      : [...q.askOf, kind];
    patch({ askOf: next });
  }

  function handleTypeChange(type: QuestionType) {
    const base: Partial<DraftQuestion> = { type };
    if (type === 'choice') {
      base.options = q.options?.length ? q.options : ['', ''];
      base.multiple = false;
    } else if (type === 'likert' || type === 'scale') {
      base.scaleLabels = q.scaleLabels ?? {};
    }
    if (type !== 'choice') { base.options = undefined; base.multiple = undefined; }
    if (type !== 'likert' && type !== 'scale') { base.scaleLabels = undefined; }
    patch(base);
  }

  const hasConfigPanel = q.type === 'choice' || q.type === 'likert' || q.type === 'scale' || q.type === 'yes_no';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className={`group relative flex flex-col rounded-xl border transition-all duration-200 ${
        hasBadField
          ? 'border-red-300 bg-red-50/50 shadow-sm shadow-red-100'
          : collapsed
            ? 'border-gray-100 bg-white shadow-sm hover:shadow-md hover:border-gray-200'
            : 'border-gray-200 bg-white shadow-sm'
      }`}
    >
      {/* ─── Collapsed header bar ─── */}
      <div className="flex items-center gap-2 px-3 py-2.5 sm:px-3.5">
        {/* Drag handle */}
        <div className="shrink-0 cursor-grab text-gray-300 opacity-0 transition-opacity group-hover:opacity-100">
          <PiDotsSixVertical className="h-4 w-4" />
        </div>

        {/* Collapse toggle */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <motion.div animate={{ rotate: collapsed ? 0 : 90 }} transition={{ duration: 0.15 }}>
            <PiCaretRight className="h-3.5 w-3.5" />
          </motion.div>
        </button>

        {/* Completion dot */}
        <motion.div
          animate={{ scale: isComplete ? [1, 1.3, 1] : 1 }}
          transition={{ duration: 0.3 }}
          className={`h-2 w-2 shrink-0 rounded-full transition-colors ${
            isComplete ? 'bg-emerald-400' : 'bg-gray-300'
          }`}
        />

        {/* Type badge */}
        <span
          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${typeInfo.bg} ${typeInfo.color} ${typeInfo.ring}`}
        >
          <typeInfo.icon className="h-3 w-3" />
          {typeInfo.shortLabel}
        </span>

        {/* Question label */}
        <span className="flex-1 min-w-0 truncate text-[13px] text-gray-700">
          {q.label || <span className="italic text-gray-400">Untitled question…</span>}
        </span>

        {/* Q number */}
        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
          Q{qi + 1}
        </span>
      </div>

      {/* ─── Expanded content ─── */}
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-4 border-t border-gray-100 px-3.5 pb-4 pt-3.5 sm:px-4">
              {/* Row 1: Question label */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                  Question
                </label>
                <Input
                  value={q.label}
                  onChange={(e) => patch({ label: e.target.value })}
                  placeholder="e.g. Quality of work, Communication skills..."
                  disabled={saving}
                />
              </div>

              {/* Row 2: Type selector */}
              <div>
                <label className="mb-2 block text-[11px] font-semibold text-gray-500">
                  Question type
                </label>
                <TemplateTypeSelector
                  value={q.type}
                  onChange={handleTypeChange}
                  disabled={saving}
                />
              </div>

              {/* Row 2.5: Scale config (for rating) */}
              {q.type === 'rating' ? (
                <div className="w-full max-w-[10rem]">
                  <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                    Scale (1 — N)
                  </label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={q.scaleMax ?? 5}
                    onChange={(e) => patch({ scaleMax: Number(e.target.value) })}
                    disabled={saving}
                  />
                </div>
              ) : null}

              {/* Row 2.6: likert/scale steps */}
              {(q.type === 'likert' || q.type === 'scale') ? (
                <div className="w-full max-w-[10rem]">
                  <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                    Number of steps
                  </label>
                  <Input
                    type="number"
                    min={3}
                    max={10}
                    value={q.scaleMax ?? 5}
                    onChange={(e) => patch({ scaleMax: Number(e.target.value) })}
                    disabled={saving}
                  />
                </div>
              ) : null}

              {/* Row 3: Type-specific config */}
              {hasConfigPanel ? (
                <TemplateQuestionConfig
                  question={q}
                  onPatch={patch}
                  disabled={saving}
                />
              ) : null}

              {/* Row 4: Help text */}
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-gray-500">
                  Help text
                </label>
                <Input
                  value={q.helpText ?? ''}
                  onChange={(e) => patch({ helpText: e.target.value })}
                  placeholder="Guides the reviewer with context or examples (optional)"
                  disabled={saving}
                />
              </div>

              {/* Row 5: Audience + Required */}
              <div className="flex flex-col gap-3 rounded-lg bg-gray-50/80 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <Text className="text-[11px] font-semibold text-gray-500">
                    Asked of
                  </Text>
                  {KINDS.map((k) => (
                    <label
                      key={k.value}
                      className="flex cursor-pointer items-center gap-1.5 text-sm text-gray-600"
                    >
                      <input
                        type="checkbox"
                        checked={q.askOf.includes(k.value)}
                        onChange={() => toggleAskOf(k.value)}
                        disabled={saving}
                        className="h-4 w-4 rounded accent-[#b20202]"
                      />
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${KIND_META[k.value].cls} ${KIND_META[k.value].ring}`}
                      >
                        {k.label}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Text className="text-[11px] font-semibold text-gray-500">
                    Required
                  </Text>
                  <Switch
                    checked={q.required}
                    onChange={(e) => patch({ required: e.target.checked })}
                    disabled={saving}
                  />
                </div>
              </div>

              {/* Row 5.5: Action buttons */}
              <div className="flex items-center gap-1 border-t border-gray-100 pt-3">
                <button
                  type="button"
                  aria-label="Move up"
                  onClick={() => onMove(si, qi, -1)}
                  disabled={saving || isFirst}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 transition-colors"
                >
                  <PiArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  onClick={() => onMove(si, qi, 1)}
                  disabled={saving || isLast}
                  className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 transition-colors"
                >
                  <PiArrowDown className="h-4 w-4" />
                </button>
                {onDuplicate ? (
                  <button
                    type="button"
                    aria-label="Duplicate"
                    onClick={() => onDuplicate(si, qi)}
                    disabled={saving}
                    className="rounded-lg p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 transition-colors"
                  >
                    <PiCopy className="h-4 w-4" />
                  </button>
                ) : null}
                {onAssist ? (
                  <div className="relative">
                    <button
                      type="button"
                      aria-label="AI assist"
                      onClick={() => setAssistOpen((v) => !v)}
                      disabled={saving || assisting}
                      className="rounded-lg p-2 text-gray-400 hover:bg-[#b20202]/5 hover:text-[#b20202] disabled:opacity-30 transition-colors"
                    >
                      <PiSparkle className={`h-4 w-4 ${assisting ? 'animate-pulse text-[#b20202]' : ''}`} />
                    </button>
                    <AnimatePresence>
                      {assistOpen ? (
                        <>
                          {/* Click-away catcher */}
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setAssistOpen(false)}
                          />
                          <motion.div
                            initial={{ opacity: 0, y: -4, scale: 0.97 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.97 }}
                            transition={{ duration: 0.12 }}
                            className="absolute left-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-lg"
                          >
                            {ASSIST_ACTIONS.filter(
                              (a) => !a.onlyChoice || q.type === 'choice'
                            ).map((a) => (
                              <button
                                key={a.mode}
                                type="button"
                                onClick={() => {
                                  setAssistOpen(false);
                                  onAssist(si, qi, a.mode);
                                }}
                                className="block w-full px-3 py-2 text-left text-[13px] text-gray-700 hover:bg-gray-50 transition-colors"
                              >
                                <span className="font-medium">{a.label}</span>
                                <span className="mt-0.5 block text-[11px] text-gray-400">
                                  {a.hint}
                                </span>
                              </button>
                            ))}
                          </motion.div>
                        </>
                      ) : null}
                    </AnimatePresence>
                  </div>
                ) : null}
                <div className="flex-1" />
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() => onRemove(si, qi)}
                  disabled={saving}
                  className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 transition-colors"
                >
                  <PiTrash className="h-4 w-4" />
                </button>
              </div>

              {/* Warning: no audience */}
              <AnimatePresence>
                {answeredCount === 0 ? (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-1.5 text-[11px] font-medium text-red-600"
                  >
                    <PiWarningCircle className="h-3.5 w-3.5 shrink-0" />
                    A question nobody is asked will never appear on any form.
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
