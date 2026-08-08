'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input, Textarea } from 'rizzui';
import {
  PiArrowLeft,
  PiCheckCircle,
  PiSparkle,
  PiWarningCircle,
  PiX,
} from 'react-icons/pi';
import {
  aiGenerateSection,
  aiGenerateTemplate,
  type DraftSection,
  type FeedbackKind,
} from '@/services/appraisal.service';
import { countQuestions, summarizeAudiences } from './template-ai-utils';
import { getTypeInfo } from './template-type-selector';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type AiModalMode = 'template' | 'section';

export interface AiTemplateResult {
  kind: 'template';
  name: string;
  description?: string;
  sections: DraftSection[];
  strategy: 'append' | 'replace';
}

export interface AiSectionResult {
  kind: 'section';
  section: DraftSection;
  /** Set when this was an expansion — the section index to grow. */
  expandIndex: number | null;
}

export type AiResult = AiTemplateResult | AiSectionResult;

interface TemplateAiModalProps {
  open: boolean;
  mode: AiModalMode;
  /** For a section expansion — which section is being grown. */
  expand?: { index: number; title: string } | null;
  /** The draft as it stands. Sent as context so nothing is re-asked. */
  currentSections: DraftSection[];
  onClose: () => void;
  onApply: (result: AiResult) => void;
}

const KINDS: { value: FeedbackKind; label: string; hint: string }[] = [
  { value: 'self', label: 'Self', hint: 'The employee rates themselves' },
  { value: 'manager', label: 'Manager', hint: 'Their line manager reviews them' },
  { value: 'peer', label: 'Peer', hint: 'Colleagues give 360° feedback' },
];

const KIND_CHIP: Record<FeedbackKind, string> = {
  self: 'bg-blue-50 text-blue-600 ring-blue-100',
  manager: 'bg-purple-50 text-purple-600 ring-purple-100',
  peer: 'bg-emerald-50 text-emerald-600 ring-emerald-100',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TemplateAiModal({
  open,
  mode,
  expand,
  currentSections,
  onClose,
  onApply,
}: TemplateAiModalProps) {
  const [role, setRole] = useState('');
  const [department, setDepartment] = useState('');
  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [audiences, setAudiences] = useState<FeedbackKind[]>(['self', 'manager']);
  // Off by default: scored questions are generated for self+manager only,
  // matching the seeded default form. This is the deliberate override, not a
  // setting HR has to find — it only appears once peers are on the form.
  const [allowPeerScoring, setAllowPeerScoring] = useState(false);
  const [sectionCount, setSectionCount] = useState(4);
  const [questionsPerSection, setQuestionsPerSection] = useState(4);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<AiResult | null>(null);

  // Reset every time the modal is opened so a previous preview can never be
  // applied to a draft HR has since edited.
  useEffect(() => {
    if (!open) return;
    setPreview(null);
    setError(null);
    setGenerating(false);
  }, [open, mode, expand?.index]);

  const previewSections = useMemo(() => {
    if (!preview) return [];
    return preview.kind === 'template' ? preview.sections : [preview.section];
  }, [preview]);

  const isExpansion = mode === 'section' && !!expand;

  function toggleAudience(kind: FeedbackKind) {
    setAudiences((prev) =>
      prev.includes(kind) ? prev.filter((k) => k !== kind) : [...prev, kind]
    );
  }

  async function handleGenerate() {
    if (audiences.length === 0) {
      setError('Pick at least one reviewer — a form nobody fills in has no questions to write.');
      return;
    }
    setGenerating(true);
    setError(null);
    try {
      if (mode === 'template') {
        const result = await aiGenerateTemplate({
          role: role.trim() || undefined,
          department: department.trim() || undefined,
          purpose: purpose.trim() || undefined,
          notes: notes.trim() || undefined,
          audiences,
          allowPeerScoring,
          sectionCount,
          questionsPerSection,
        });
        setPreview({
          kind: 'template',
          name: result.name,
          description: result.description,
          sections: result.sections,
          strategy: 'append',
        });
      } else {
        const section = await aiGenerateSection({
          role: role.trim() || undefined,
          department: department.trim() || undefined,
          notes: notes.trim() || undefined,
          audiences,
          allowPeerScoring,
          questionCount: questionsPerSection,
          expandSectionTitle: expand?.title || undefined,
          existingSections: currentSections,
        });
        setPreview({
          kind: 'section',
          section,
          expandIndex: expand ? expand.index : null,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  }

  function apply(strategy: 'append' | 'replace') {
    if (!preview) return;
    onApply(preview.kind === 'template' ? { ...preview, strategy } : preview);
  }

  if (!open) return null;

  const title = isExpansion
    ? `Add questions to “${expand?.title || 'this section'}”`
    : mode === 'section'
      ? 'Generate a section'
      : 'Generate a review form';

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm sm:items-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          onClick={(e) => e.stopPropagation()}
          className="my-auto w-full max-w-2xl rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          {/* ─── Header ─── */}
          <div className="flex items-start gap-3 border-b border-gray-100 px-5 py-4 sm:px-6">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#b20202]/10 to-purple-100">
              <PiSparkle className="h-5 w-5 text-[#b20202]" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-base font-semibold text-gray-900">{title}</h3>
              <p className="mt-0.5 text-xs text-gray-500">
                {preview
                  ? 'Nothing has been added yet — review the draft, then choose how to use it.'
                  : 'Describe the review in a sentence or two. You will see the draft before anything lands on your form.'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
            >
              <PiX className="h-4 w-4" />
            </button>
          </div>

          {/* ─── Body ─── */}
          <div className="max-h-[60vh] overflow-y-auto px-5 py-5 sm:px-6">
            {preview ? (
              <PreviewPanel sections={previewSections} result={preview} />
            ) : (
              <div className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      Role being reviewed
                    </label>
                    <Input
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      placeholder="e.g. Warehouse Supervisor"
                      disabled={generating}
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      Department
                    </label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Logistics"
                      disabled={generating}
                    />
                  </div>
                </div>

                {mode === 'template' ? (
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      Purpose of the review
                    </label>
                    <Input
                      value={purpose}
                      onChange={(e) => setPurpose(e.target.value)}
                      placeholder="e.g. Annual performance and development review"
                      disabled={generating}
                    />
                  </div>
                ) : null}

                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                    {mode === 'template'
                      ? 'Anything else it should cover (optional)'
                      : 'What should this section cover?'}
                  </label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder={
                      mode === 'template'
                        ? 'e.g. Emphasise stock accuracy and safety compliance. Include a goals section.'
                        : 'e.g. Customer service behaviours at the bar during peak hours'
                    }
                    disabled={generating}
                  />
                </div>

                {/* Audiences */}
                <div className="rounded-xl bg-gray-50/80 px-4 py-3.5">
                  <p className="mb-2.5 text-[11px] font-semibold text-gray-500">
                    Who fills this form in?
                  </p>
                  <div className="flex flex-col gap-2 sm:flex-row sm:gap-5">
                    {KINDS.map((k) => (
                      <label
                        key={k.value}
                        className="flex cursor-pointer items-start gap-2 text-sm text-gray-600"
                      >
                        <input
                          type="checkbox"
                          checked={audiences.includes(k.value)}
                          onChange={() => toggleAudience(k.value)}
                          disabled={generating}
                          className="mt-0.5 h-4 w-4 rounded accent-[#b20202]"
                        />
                        <span>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${KIND_CHIP[k.value]}`}
                          >
                            {k.label}
                          </span>
                          <span className="mt-0.5 block text-[11px] text-gray-400">
                            {k.hint}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="mt-2.5 text-[11px] leading-relaxed text-gray-400">
                    Scored questions are always asked of the employee too when a self
                    review is included — otherwise there is nothing to compare their
                    reviewers against.
                  </p>

                  {audiences.includes('peer') && (
                    <div className="mt-3 border-t border-gray-200/80 pt-3">
                      <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-600">
                        <input
                          type="checkbox"
                          checked={allowPeerScoring}
                          onChange={() => setAllowPeerScoring((v) => !v)}
                          disabled={generating}
                          className="mt-0.5 h-4 w-4 rounded accent-[#b20202]"
                        />
                        <span>
                          Let peers score too
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-gray-400">
                            Off by default. Peers are asked for a specific example they
                            saw rather than a rating — a colleague in another team has
                            no basis to score something like &ldquo;quality of
                            work&rdquo;, and the guess still ends up in an average.
                          </span>
                        </span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Size */}
                <div className="grid gap-4 sm:grid-cols-2">
                  {mode === 'template' ? (
                    <div>
                      <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                        Sections
                      </label>
                      <Input
                        type="number"
                        min={2}
                        max={8}
                        value={sectionCount}
                        onChange={(e) => setSectionCount(Number(e.target.value))}
                        disabled={generating}
                      />
                    </div>
                  ) : null}
                  <div>
                    <label className="mb-1.5 block text-[11px] font-semibold text-gray-500">
                      {mode === 'template' ? 'Questions per section' : 'Questions'}
                    </label>
                    <Input
                      type="number"
                      min={2}
                      max={12}
                      value={questionsPerSection}
                      onChange={(e) => setQuestionsPerSection(Number(e.target.value))}
                      disabled={generating}
                    />
                  </div>
                </div>

                {mode === 'section' && currentSections.length > 0 ? (
                  <p className="text-[11px] text-gray-400">
                    Your existing {countQuestions(currentSections)} question
                    {countQuestions(currentSections) === 1 ? '' : 's'} are sent as
                    context, so nothing already on the form gets asked twice.
                  </p>
                ) : null}
              </div>
            )}

            <AnimatePresence>
              {error ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3"
                >
                  <PiWarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
                  <p className="text-xs text-red-700">{error}</p>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>

          {/* ─── Footer ─── */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 px-5 py-4 sm:px-6">
            {preview ? (
              <>
                <button
                  type="button"
                  onClick={() => setPreview(null)}
                  className="mr-auto inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                >
                  <PiArrowLeft className="h-3.5 w-3.5" />
                  Change the brief
                </button>
                {preview.kind === 'template' ? (
                  <button
                    type="button"
                    onClick={() => apply('replace')}
                    className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                  >
                    Replace all
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => apply('append')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8f0202] transition-colors"
                >
                  <PiCheckCircle className="h-4 w-4" />
                  {preview.kind === 'template' ? 'Append to form' : 'Add to form'}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#b20202] px-4 py-2 text-sm font-semibold text-white hover:bg-[#8f0202] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  <PiSparkle className={`h-4 w-4 ${generating ? 'animate-pulse' : ''}`} />
                  {generating ? 'Writing questions…' : 'Generate'}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ---------------------------------------------------------------------------
// Preview
// ---------------------------------------------------------------------------
function PreviewPanel({
  sections,
  result,
}: {
  sections: DraftSection[];
  result: AiResult;
}) {
  const total = countQuestions(sections);
  const kinds = summarizeAudiences(sections);

  return (
    <div className="flex flex-col gap-4">
      {result.kind === 'template' ? (
        <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">{result.name}</p>
          {result.description ? (
            <p className="mt-1 text-xs leading-relaxed text-gray-500">
              {result.description}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-gray-500">
        <span className="rounded-md bg-gray-100 px-2 py-0.5">
          {sections.length} section{sections.length === 1 ? '' : 's'}
        </span>
        <span className="rounded-md bg-gray-100 px-2 py-0.5">
          {total} question{total === 1 ? '' : 's'}
        </span>
        {kinds.map((k) => (
          <span
            key={k}
            className={`rounded-full px-2 py-0.5 font-semibold ring-1 ring-inset ${KIND_CHIP[k]}`}
          >
            {k}
          </span>
        ))}
      </div>

      {sections.map((section, si) => (
        <div key={si} className="rounded-xl border border-gray-200">
          <div className="border-b border-gray-100 px-4 py-2.5">
            <p className="text-[13px] font-semibold text-gray-800">{section.title}</p>
          </div>
          <ul className="divide-y divide-gray-50">
            {section.questions.map((q, qi) => {
              const info = getTypeInfo(q.type);
              return (
                <li key={qi} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span
                    className={`mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${info.bg} ${info.color} ${info.ring}`}
                  >
                    <info.icon className="h-2.5 w-2.5" />
                    {info.shortLabel}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] leading-snug text-gray-700">{q.label}</p>
                    {q.helpText ? (
                      <p className="mt-0.5 text-[11px] text-gray-400">{q.helpText}</p>
                    ) : null}
                    {q.options?.length ? (
                      <p className="mt-1 text-[11px] text-gray-400">
                        {q.options.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 gap-1">
                    {q.askOf.map((k) => (
                      <span
                        key={k}
                        title={k}
                        className={`h-1.5 w-1.5 rounded-full ${
                          k === 'self'
                            ? 'bg-blue-400'
                            : k === 'manager'
                              ? 'bg-purple-400'
                              : 'bg-emerald-400'
                        }`}
                      />
                    ))}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
