'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, MotionConfig } from 'framer-motion';
import { PiArrowLeft, PiSparkle, PiWarningCircle } from 'react-icons/pi';
import {
  ApiError,
  aiAssistQuestion,
  createTemplate,
  fetchTemplate,
  updateTemplate,
  type DraftQuestion,
  type DraftSection,
  type FeedbackKind,
} from '@/services/appraisal.service';
import { useUndoRedo } from './use-undo-redo';
import { blankSections } from './template-presets';
import {
  appendGeneratedSections,
  appendQuestionsToSection,
  applyQuestionAssist,
} from './template-ai-utils';
import TemplatePresetPicker from './template-preset-picker';
import TemplateFormHeader from './template-form-header';
import TemplateFormSummary from './template-form-summary';
import TemplateSectionCard from './template-section-card';
import TemplateFormFooter from './template-form-footer';
import TemplateAiModal, { type AiModalMode, type AiResult } from './template-ai-modal';

/**
 * A per-question assist is deliberately NOT scoped to the audiences the form
 * currently happens to ask. HR is tuning one question, and narrowing the
 * suggestion to the kinds already in use would make "suggest who should answer
 * this" incapable of ever proposing a kind the form does not yet have. The
 * server's 360 rule still applies to whatever comes back.
 */
const ALL_KINDS: FeedbackKind[] = ['self', 'manager', 'peer'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function moved<T>(arr: T[], from: number, dir: -1 | 1): T[] {
  const to = from + dir;
  if (to < 0 || to >= arr.length) return arr;
  const next = [...arr];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

function blankQuestion(): DraftQuestion {
  return {
    type: 'rating',
    label: '',
    required: true,
    scaleMax: 5,
    askOf: ['self', 'manager', 'peer'],
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function TemplateEditor({ id }: { id: string }) {
  const router = useRouter();
  const isNew = id === 'new';

  // --- Preset state (only used for /new) ---
  const [presetChosen, setPresetChosen] = useState(!isNew);

  // --- Form state with undo/redo ---
  const { state: sections, set: setSections, undo, redo, canUndo, canRedo } =
    useUndoRedo<DraftSection[]>([blankSections()[0]]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState(1);
  const [hasLaunchedCycle, setHasLaunchedCycle] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [badFields, setBadFields] = useState<string[]>([]);

  // --- AI generation state ---
  const [aiModal, setAiModal] = useState<{
    mode: AiModalMode;
    expand: { index: number; title: string } | null;
  } | null>(null);
  /** `${sectionIndex}:${questionIndex}` while a per-question assist is in flight. */
  const [assisting, setAssisting] = useState<string | null>(null);

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  // --- Load existing template (edit mode) ---
  useEffect(() => {
    if (isNew) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const t = await fetchTemplate(id);
        if (cancelled) return;
        setName(t.name);
        setDescription(t.description || '');
        setSections(t.sections?.length ? t.sections : [blankSections()[0]]);
        setVersion(t.version);
        setHasLaunchedCycle(t.hasLaunchedCycle);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to load this form'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, isNew, setSections]);

  // --- Preset callback ---
  const handlePreset = useCallback(
    (
      presetSections: DraftSection[],
      presetName: string,
      presetDescription: string
    ) => {
      if (presetSections.length > 0) {
        setSections(presetSections);
        setName(presetName);
        setDescription(presetDescription);
      }
      setPresetChosen(true);
    },
    [setSections]
  );

  // --- Question mutation helpers ---
  function patchQuestion(si: number, qi: number, patch: Partial<DraftQuestion>) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : {
              ...s,
              questions: s.questions.map((q, j) =>
                j !== qi ? q : { ...q, ...patch }
              ),
            }
      )
    );
  }

  function moveQuestion(si: number, qi: number, dir: -1 | 1) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== si ? s : { ...s, questions: moved(s.questions, qi, dir) }
      )
    );
  }

  function removeQuestion(si: number, qi: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i !== si
          ? s
          : { ...s, questions: s.questions.filter((_, j) => j !== qi) }
      )
    );
  }

  function addQuestion(si: number) {
    setSections((prev) =>
      prev.map((s, i) =>
        i === si
          ? { ...s, questions: [...s.questions, blankQuestion()] }
          : s
      )
    );
  }

  function duplicateQuestion(si: number, qi: number) {
    setSections((prev) =>
      prev.map((s, i) => {
        if (i !== si) return s;
        const copy = { ...s.questions[qi] };
        // Server mints _id on save — never clone an existing id.
        const { _id: _unused, ...rest } = copy as any;
        const dup = { ...rest };
        const next = [...s.questions];
        next.splice(qi + 1, 0, dup);
        return { ...s, questions: next };
      })
    );
  }

  // --- Section mutation helpers ---
  function patchSectionTitle(si: number, title: string) {
    setSections((prev) =>
      prev.map((s, i) => (i === si ? { ...s, title } : s))
    );
  }

  function moveSection(si: number, dir: -1 | 1) {
    setSections((prev) => moved(prev, si, dir));
  }

  function removeSection(si: number) {
    setSections((prev) => prev.filter((_, i) => i !== si));
  }

  function addSection() {
    setSections((prev) => [
      ...prev,
      { title: '', questions: [blankQuestion()] },
    ]);
  }

  // --- AI handlers ---
  /**
   * Lands a previewed generation on the draft. Every branch is ONE
   * `setSections` call, so one generation is one Cmd+Z — undoing an AI form
   * must not peel it off a section at a time.
   */
  function handleAiApply(result: AiResult) {
    if (result.kind === 'template') {
      if (result.strategy === 'replace') {
        setSections(result.sections);
        if (result.name) setName(result.name);
        setDescription(result.description || '');
      } else {
        setSections((prev) => appendGeneratedSections(prev, result.sections));
        // Only fill a name HR has not written themselves.
        if (!name.trim() && result.name) setName(result.name);
        if (!description.trim() && result.description) setDescription(result.description);
      }
      toast.success(
        result.strategy === 'replace' ? 'Form replaced with the draft' : 'Draft added to your form'
      );
    } else if (result.expandIndex !== null) {
      setSections((prev) =>
        appendQuestionsToSection(prev, result.expandIndex as number, result.section.questions)
      );
      toast.success('Questions added to the section');
    } else {
      setSections((prev) => appendGeneratedSections(prev, [result.section]));
      toast.success('Section added');
    }
    setAiModal(null);
  }

  async function handleQuestionAssist(
    si: number,
    qi: number,
    mode: 'label' | 'options' | 'askOf'
  ) {
    const question = sections[si]?.questions?.[qi];
    if (!question) return;
    if (mode !== 'label' && !question.label.trim()) {
      toast.error('Write the question first — there is nothing to work from yet.');
      return;
    }

    setAssisting(`${si}:${qi}`);
    try {
      const improved = await aiAssistQuestion({
        mode,
        question,
        audiences: ALL_KINDS,
        role: name.trim() || undefined,
        sectionTitle: sections[si].title.trim() || undefined,
      });
      setSections((prev) => applyQuestionAssist(prev, si, qi, improved));
      toast.success(
        mode === 'label'
          ? 'Question rewritten'
          : mode === 'options'
            ? 'Options suggested'
            : 'Reviewers suggested'
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not improve this question');
    } finally {
      setAssisting(null);
    }
  }

  // --- Validation ---
  const emptyAskOf = sections.some((s) =>
    s.questions.some((q) => q.askOf.length === 0)
  );
  const missingLabel = sections.some((s) =>
    s.questions.some((q) => !q.label.trim())
  );
  const missingTitle = sections.some((s) => !s.title.trim());
  const noQuestions = sections.some((s) => s.questions.length === 0);
  const blockedReason = !name.trim()
    ? 'Give the form a name.'
    : missingTitle
      ? 'Every section needs a title.'
      : noQuestions
        ? 'Every section needs at least one question.'
        : missingLabel
          ? 'Every question needs a label.'
          : emptyAskOf
            ? 'A question nobody is asked will never appear on any form.'
            : null;

  // --- Save handler ---
  async function handleSave() {
    if (blockedReason) {
      toast.error(blockedReason);
      return;
    }
    setSaving(true);
    setBadFields([]);
    try {
      const body = {
        name: name.trim(),
        description: description.trim() || undefined,
        sections,
      };
      if (isNew) {
        const created = await createTemplate(body);
        toast.success('Form created');
        router.push(`/appraisals/templates/${created._id}`);
        return;
      }
      const saved = await updateTemplate(id, body);
      if (saved.forked) {
        toast.success(`Saved as version ${saved.version}`);
        router.push(`/appraisals/templates/${saved._id}`);
        return;
      }
      toast.success('Form saved');
      setVersion(saved.version);
    } catch (err) {
      if (err instanceof ApiError && err.fields?.length) {
        setBadFields(err.fields);
      }
      toast.error(
        err instanceof Error ? err.message : 'Could not save this form'
      );
    } finally {
      setSaving(false);
    }
  }

  // --- Loading skeleton ---
  if (loading) {
    return (
      <div className="flex flex-col gap-4 px-6 py-8 md:px-10 lg:px-14">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
        ))}
      </div>
    );
  }

  // --- /new flow: show preset picker first, then editor ---
  if (isNew && !presetChosen) {
    return <TemplatePresetPicker onPreset={handlePreset} />;
  }

  // --- Editor view (both /new-after-preset and /edit) ---
  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-col gap-5 px-4 py-6 sm:gap-6 sm:px-6 sm:py-8 md:px-10 lg:px-14">
        {/* Back link + title + undo/redo */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/appraisals/templates"
              className="mb-3 inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 hover:text-gray-700 transition-colors"
            >
              <PiArrowLeft className="h-3.5 w-3.5" />
              All review forms
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {isNew ? 'New review form' : `Edit form (v${version})`}
            </h1>
          </div>

          {/* AI generate + undo/redo */}
          <div className="flex items-center gap-1 pt-8">
            <button
              type="button"
              onClick={() => setAiModal({ mode: 'template', expand: null })}
              disabled={saving}
              className="mr-1 inline-flex items-center gap-1.5 rounded-xl border border-[#b20202]/20 bg-gradient-to-r from-[#b20202]/5 to-purple-50 px-3 py-2 text-sm font-semibold text-[#b20202] hover:from-[#b20202]/10 hover:to-purple-100 disabled:opacity-50 transition-colors"
            >
              <PiSparkle className="h-4 w-4" />
              <span className="hidden sm:inline">Generate with AI</span>
              <span className="sm:hidden">AI</span>
            </button>
            <button
              type="button"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Cmd+Z)"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 7v6h6" /><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
              </svg>
            </button>
            <button
              type="button"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Cmd+Shift+Z)"
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 7v6h-6" /><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
              </svg>
            </button>
          </div>
        </div>

        {/* Fork warning */}
        {hasLaunchedCycle ? (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/50 px-4 py-3"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100">
              <PiWarningCircle className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">
                Version fork on save
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                Saving will create version {version + 1}. Cycles already running
                keep the version they launched with, so reviews in progress are not
                affected.
              </p>
            </div>
          </motion.div>
        ) : null}

        {/* Name + Description */}
        <TemplateFormHeader
          name={name}
          description={description}
          onNameChange={setName}
          onDescriptionChange={setDescription}
          saving={saving}
        />

        {/* Form summary stats */}
        <TemplateFormSummary sections={sections} />

        {/* Sections */}
        <div className="flex flex-col gap-5">
          {sections.map((section, si) => (
            <TemplateSectionCard
              key={si}
              section={section}
              sectionIndex={si}
              isFirst={si === 0}
              isLast={si === sections.length - 1}
              totalSections={sections.length}
              hasBadField={badFields.includes('sections')}
              saving={saving}
              onTitleChange={patchSectionTitle}
              onMove={moveSection}
              onRemove={removeSection}
              onAddQuestion={addQuestion}
              onPatchQuestion={patchQuestion}
              onMoveQuestion={moveQuestion}
              onRemoveQuestion={removeQuestion}
              onDuplicateQuestion={duplicateQuestion}
              onExpandWithAi={(index) =>
                setAiModal({
                  mode: 'section',
                  expand: { index, title: section.title || `Section ${index + 1}` },
                })
              }
              onAssistQuestion={handleQuestionAssist}
              assistingKey={assisting}
            />
          ))}
        </div>

        {/* Add a whole section with AI */}
        <button
          type="button"
          onClick={() => setAiModal({ mode: 'section', expand: null })}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-dashed border-[#b20202]/30 bg-[#b20202]/[0.03] px-4 py-3 text-sm font-medium text-[#b20202] hover:bg-[#b20202]/[0.07] disabled:opacity-50 transition-colors"
        >
          <PiSparkle className="h-4 w-4" />
          Add a section with AI
        </button>

        {/* Sticky footer */}
        <TemplateFormFooter
          saving={saving}
          blockedReason={blockedReason}
          onSave={handleSave}
          onAddSection={addSection}
        />

        {/* AI generation — previews first, never writes straight into the draft */}
        <TemplateAiModal
          open={aiModal !== null}
          mode={aiModal?.mode ?? 'template'}
          expand={aiModal?.expand ?? null}
          currentSections={sections}
          onClose={() => setAiModal(null)}
          onApply={handleAiApply}
        />
      </div>
    </MotionConfig>
  );
}
