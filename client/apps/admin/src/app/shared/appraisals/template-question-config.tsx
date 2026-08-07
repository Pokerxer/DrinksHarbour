'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from 'rizzui';
import { PiPlusBold, PiTrash, PiWarningCircle } from 'react-icons/pi';
import type { DraftQuestion } from '@/services/appraisal.service';

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

  return (
    <AnimatePresence mode="wait">
      {t === 'choice' && (
        <ConfigWrapper key="choice">
          <ChoiceConfig question={question} onPatch={onPatch} disabled={disabled} />
        </ConfigWrapper>
      )}
      {t === 'likert' && (
        <ConfigWrapper key="likert">
          <LikertConfig question={question} onPatch={onPatch} disabled={disabled} />
        </ConfigWrapper>
      )}
      {t === 'scale' && (
        <ConfigWrapper key="scale">
          <ScaleConfig question={question} onPatch={onPatch} disabled={disabled} />
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
        <label className="text-[11px] font-semibold text-gray-500">Options</label>
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
              className="shrink-0 rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 transition-colors"
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
      <label className="text-[11px] font-semibold text-gray-500">Scale labels</label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Lowest (1)</p>
          <Input
            value={labels.low ?? ''}
            onChange={(e) => onPatch({ scaleLabels: { ...labels, low: e.target.value } })}
            placeholder="e.g. Strongly Disagree"
            disabled={disabled}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Highest ({question.scaleMax ?? 5})</p>
          <Input
            value={labels.high ?? ''}
            onChange={(e) => onPatch({ scaleLabels: { ...labels, high: e.target.value } })}
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
      <label className="text-[11px] font-semibold text-gray-500">Scale endpoints</label>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Left endpoint</p>
          <Input
            value={labels.low ?? ''}
            onChange={(e) => onPatch({ scaleLabels: { ...labels, low: e.target.value } })}
            placeholder="e.g. Poor"
            disabled={disabled}
          />
        </div>
        <div>
          <p className="mb-1 text-[10px] text-gray-400">Right endpoint</p>
          <Input
            value={labels.high ?? ''}
            onChange={(e) => onPatch({ scaleLabels: { ...labels, high: e.target.value } })}
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
      Reviewers will see two buttons: <span className="font-medium text-gray-600">Yes</span> and{' '}
      <span className="font-medium text-gray-600">No</span>. Add a text question below for optional follow-up comments.
    </p>
  );
}
