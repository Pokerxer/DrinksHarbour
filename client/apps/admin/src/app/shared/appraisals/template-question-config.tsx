'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from 'rizzui';
import { PiPlusBold, PiTrash, PiWarningCircle } from 'react-icons/pi';
import type { DraftQuestion } from '@/services/appraisal.service';
import {
  hasOptionScores,
  enableOptionScores,
  addScoredRow,
  removeScoredRow,
  setScoredLabel,
  setScoredScore,
  syncScoredKeys,
  scoreInputValue,
  scaleMaxOrDefault,
  optionScoreProblem,
  type ScoredRows,
} from './template-option-scores';

// ---------------------------------------------------------------------------
// Panel wrapper
// ---------------------------------------------------------------------------
interface TemplateQuestionConfigProps {
  question: DraftQuestion;
  onPatch: (patch: Partial<DraftQuestion>) => void;
  disabled?: boolean;
}

export default function TemplateQuestionConfig({
  question,
  onPatch,
  disabled,
}: TemplateQuestionConfigProps) {
  const t = question.type;
  // Scoring replaces the number scale with described anchors, so the scale's
  // own endpoint labels stop being rendered anywhere on the reviewer's form.
  // Hiding them is not cosmetic: leaving two live inputs on screen that no
  // longer reach the form is how an author spends five minutes wording a
  // "Highest (5)" nobody will ever see.
  const scored = hasOptionScores(question);

  return (
    <AnimatePresence mode="wait">
      {t === 'choice' && (
        <ConfigWrapper key="choice">
          <ChoiceConfig
            question={question}
            onPatch={onPatch}
            disabled={disabled}
          />
        </ConfigWrapper>
      )}
      {t === 'rating' && (
        <ConfigWrapper key="rating">
          <ScoredOptionsConfig
            question={question}
            onPatch={onPatch}
            disabled={disabled}
          />
        </ConfigWrapper>
      )}
      {t === 'likert' && (
        <ConfigWrapper key="likert">
          {!scored && (
            <LikertConfig
              question={question}
              onPatch={onPatch}
              disabled={disabled}
            />
          )}
          <ScoredOptionsConfig
            question={question}
            onPatch={onPatch}
            disabled={disabled}
            className={scored ? undefined : 'mt-4 border-t border-gray-100 pt-3.5'}
          />
        </ConfigWrapper>
      )}
      {t === 'scale' && (
        <ConfigWrapper key="scale">
          {!scored && (
            <ScaleConfig
              question={question}
              onPatch={onPatch}
              disabled={disabled}
            />
          )}
          <ScoredOptionsConfig
            question={question}
            onPatch={onPatch}
            disabled={disabled}
            className={scored ? undefined : 'mt-4 border-t border-gray-100 pt-3.5'}
          />
        </ConfigWrapper>
      )}
      {t === 'yes_no' && (
        <ConfigWrapper key="yes_no">
          <YesNoHint />
        </ConfigWrapper>
      )}
    </AnimatePresence>
  );
}

function ConfigWrapper({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 28 }}
      className="overflow-hidden"
    >
      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3.5">
        {children}
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// Choice config
// ---------------------------------------------------------------------------
function ChoiceConfig({
  question,
  onPatch,
  disabled,
}: {
  question: DraftQuestion;
  onPatch: (p: Partial<DraftQuestion>) => void;
  disabled?: boolean;
}) {
  const options = question.options ?? [];

  /**
   * Options are bare strings on the wire, so there is no id to key a row by
   * and two options may legitimately read the same while being typed. This
   * keeps a parallel list of client-side keys that moves with the options:
   * deleting the second of four used to leave the caret in a row that now
   * held the third option's text, because the input node was reused.
   */
  const [rowKeys, setRowKeys] = useState<number[]>(() =>
    options.map((_, i) => i)
  );
  // Derived, not stored in a ref: a counter mutated during render advances
  // twice under React's development double-invoke. Reading the current maximum
  // is pure and gives the same guarantee — a key never reused while these
  // options are on screen.
  const nextKey = rowKeys.length > 0 ? Math.max(...rowKeys) + 1 : 0;
  // Options that arrived from elsewhere (AI assist, a preset, an undo) need
  // the key list resized to match rather than reconciled by index. Setting
  // state during render of this same component is React's supported way to
  // adjust to changed props.
  //
  // It terminates because the resize is driven by `options.length` alone and
  // the next render therefore sees equal lengths — NOT because `onPatch`
  // happens to be synchronous. Keep it that way: deriving the new keys from
  // anything that `onPatch` feeds back (or making the write below conditional
  // on a value `onPatch` controls) turns a debounced or async patch into an
  // infinite render loop.
  if (rowKeys.length !== options.length) {
    setRowKeys(options.map((_, i) => rowKeys[i] ?? nextKey + i));
  }

  function setOptions(next: string[], keys: number[]) {
    setRowKeys(keys);
    onPatch({ options: next });
  }
  function addOption() {
    setOptions([...options, ''], [...rowKeys, nextKey]);
  }
  function updateOption(i: number, val: string) {
    setOptions(
      options.map((o, j) => (j === i ? val : o)),
      rowKeys
    );
  }
  function removeOption(i: number) {
    setOptions(
      options.filter((_, j) => j !== i),
      rowKeys.filter((_, j) => j !== i)
    );
  }

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold text-gray-500">
          Options
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-gray-500">
          <input
            type="checkbox"
            checked={question.multiple ?? false}
            onChange={(e) => onPatch({ multiple: e.target.checked })}
            disabled={disabled}
            className="h-3.5 w-3.5 rounded accent-[#b20202]"
          />
          Allow multiple selections
        </label>
      </div>

      <div className="flex flex-col gap-2">
        {options.map((opt, i) => (
          <motion.div
            key={rowKeys[i] ?? i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            className="flex items-center gap-2"
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-400">
              {i + 1}
            </span>
            <Input
              value={opt}
              onChange={(e) => updateOption(i, e.target.value)}
              placeholder={`Option ${i + 1}`}
              disabled={disabled}
            />
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={disabled || options.length <= 2}
              className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
            >
              <PiTrash className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        ))}
      </div>

      {options.length < 10 ? (
        <button
          type="button"
          onClick={addOption}
          disabled={disabled}
          className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[#b20202] hover:underline disabled:opacity-50"
        >
          <PiPlusBold className="h-3 w-3" />
          Add option
        </button>
      ) : null}

      {options.some((o) => !o.trim()) ? (
        <p className="flex items-center gap-1 text-[11px] text-amber-600">
          <PiWarningCircle className="h-3 w-3" />
          Each option needs a label.
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scored anchors
// ---------------------------------------------------------------------------
/**
 * Author described options that each carry a hidden score.
 *
 * The rater sees only the wording; the score at the same index is what gets
 * stored and totalled. Every rule that can silently break that pairing lives in
 * template-option-scores.ts and is tested there — this is a renderer over it.
 */
function ScoredOptionsConfig({
  question,
  onPatch,
  disabled,
  className,
}: {
  question: DraftQuestion;
  onPatch: (p: Partial<DraftQuestion>) => void;
  disabled?: boolean;
  className?: string;
}) {
  const on = hasOptionScores(question);
  const options = question.options ?? [];
  const optionScores = question.optionScores ?? [];
  const scaleMax = scaleMaxOrDefault(question.scaleMax);

  // Same parallel-key device as ChoiceConfig, and for the same reason: options
  // are bare strings with no id, so deleting the second of four would otherwise
  // reuse the input node and leave the caret in a row now holding other text.
  // Resized during render, driven by `options.length` alone — see the longer
  // note in ChoiceConfig for why that terminates and must stay that way.
  const [rowKeys, setRowKeys] = useState<number[]>(() =>
    options.map((_, i) => i)
  );
  if (rowKeys.length !== options.length) {
    setRowKeys(syncScoredKeys(rowKeys, options.length));
  }

  const rows: ScoredRows = { options, optionScores, keys: rowKeys };

  function write(next: ScoredRows) {
    setRowKeys(next.keys);
    // Both arrays go in ONE patch. Two patches would leave a render in between
    // where the lists disagree, and the mismatch is exactly what makes an
    // answer save with no rating at all.
    onPatch({ options: next.options, optionScores: next.optionScores });
  }

  function toggle(next: boolean) {
    if (next) {
      onPatch(enableOptionScores(question));
      return;
    }
    // Clears the options too. They exist only to carry the scores here — the
    // reviewer's ScaleField ignores `options` outright — so leaving them would
    // ship dead strings on every later save.
    onPatch({ options: undefined, optionScores: undefined });
  }

  const problem = on
    ? optionScoreProblem(options, optionScores, question.scaleMax)
    : null;

  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => toggle(e.target.checked)}
          disabled={disabled}
          className="mt-0.5 h-3.5 w-3.5 rounded accent-[#b20202]"
        />
        <span>
          <span className="block text-[11px] font-semibold text-gray-600">
            Score described options
          </span>
          <span className="block text-[10px] leading-relaxed text-gray-400">
            Reviewers pick one description instead of a number. The score each
            one carries is never shown to them and counts towards the final
            mark.
          </span>
        </span>
      </label>

      {on && (
        <div className="mt-3 flex flex-col gap-2.5">
          <div className="flex items-center gap-2 pl-8 text-[10px] font-semibold text-gray-400">
            <span className="flex-1">What the reviewer reads</span>
            <span className="w-16 shrink-0 text-center">Score</span>
            <span className="w-6 shrink-0" />
          </div>

          <div className="flex flex-col gap-2">
            {options.map((opt, i) => (
              <motion.div
                key={rowKeys[i] ?? i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="flex items-center gap-2"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-gray-100 text-[11px] font-bold text-gray-400">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Input
                    value={opt}
                    onChange={(e) =>
                      write(setScoredLabel(rows, i, e.target.value))
                    }
                    placeholder={`Description ${i + 1}`}
                    disabled={disabled}
                  />
                </div>
                <div className="w-16 shrink-0">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={scaleMax}
                    // A cleared box stays cleared. Coercing it to 0 would
                    // author a real score — the bottom anchor of a 0-based
                    // sheet — that nobody chose.
                    value={scoreInputValue(optionScores[i])}
                    onChange={(e) =>
                      write(setScoredScore(rows, i, e.target.value))
                    }
                    disabled={disabled}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => write(removeScoredRow(rows, i))}
                  disabled={disabled || options.length <= 2}
                  className="shrink-0 rounded-lg p-1.5 text-gray-300 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
                >
                  <PiTrash className="h-3.5 w-3.5" />
                </button>
              </motion.div>
            ))}
          </div>

          {options.length < 10 ? (
            <button
              type="button"
              onClick={() => write(addScoredRow(rows, scaleMax))}
              disabled={disabled}
              className="inline-flex w-fit items-center gap-1 text-[11px] font-semibold text-[#b20202] hover:underline disabled:opacity-50"
            >
              <PiPlusBold className="h-3 w-3" />
              Add option
            </button>
          ) : null}

          {options.some((o) => !o.trim()) ? (
            <p className="flex items-center gap-1 text-[11px] text-amber-600">
              <PiWarningCircle className="h-3 w-3" />
              Each option needs a description.
            </p>
          ) : null}

          {/* The server refuses to save any of these. Shown here so the author
              sees it while writing rather than as a 400 on a finished form. */}
          {problem ? (
            <p className="flex items-start gap-1 text-[11px] text-red-600">
              <PiWarningCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {problem}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Likert config
// ---------------------------------------------------------------------------
function LikertConfig({
  question,
  onPatch,
  disabled,
}: {
  question: DraftQuestion;
  onPatch: (p: Partial<DraftQuestion>) => void;
  disabled?: boolean;
}) {
  const labels = question.scaleLabels ?? {};

  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-[11px] font-semibold text-gray-500">
        Scale labels
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Lowest (1)</p>
          <Input
            value={labels.low ?? ''}
            onChange={(e) =>
              onPatch({ scaleLabels: { ...labels, low: e.target.value } })
            }
            placeholder="e.g. Strongly Disagree"
            disabled={disabled}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-gray-400">
            Highest ({question.scaleMax ?? 5})
          </p>
          <Input
            value={labels.high ?? ''}
            onChange={(e) =>
              onPatch({ scaleLabels: { ...labels, high: e.target.value } })
            }
            placeholder="e.g. Strongly Agree"
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Scale config
// ---------------------------------------------------------------------------
function ScaleConfig({
  question,
  onPatch,
  disabled,
}: {
  question: DraftQuestion;
  onPatch: (p: Partial<DraftQuestion>) => void;
  disabled?: boolean;
}) {
  const labels = question.scaleLabels ?? {};

  return (
    <div className="flex flex-col gap-2.5">
      <label className="text-[11px] font-semibold text-gray-500">
        Scale endpoints
      </label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Left endpoint</p>
          <Input
            value={labels.low ?? ''}
            onChange={(e) =>
              onPatch({ scaleLabels: { ...labels, low: e.target.value } })
            }
            placeholder="e.g. Poor"
            disabled={disabled}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Right endpoint</p>
          <Input
            value={labels.high ?? ''}
            onChange={(e) =>
              onPatch({ scaleLabels: { ...labels, high: e.target.value } })
            }
            placeholder="e.g. Excellent"
            disabled={disabled}
          />
        </div>
      </div>
      {/* Visual preview */}
      <div className="mt-1 flex items-center gap-2">
        <span className="text-[10px] text-gray-400">{labels.low || '—'}</span>
        <div className="h-1.5 flex-1 rounded-full bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200" />
        <span className="text-[10px] text-gray-400">{labels.high || '—'}</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Yes/No hint
// ---------------------------------------------------------------------------
function YesNoHint() {
  return (
    <p className="text-[11px] text-gray-400">
      Reviewers will see two buttons:{' '}
      <span className="font-medium text-gray-600">Yes</span> and{' '}
      <span className="font-medium text-gray-600">No</span>. Add a text question
      below for optional follow-up comments.
    </p>
  );
}
