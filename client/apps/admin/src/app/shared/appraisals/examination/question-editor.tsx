import AppraisalSelect from '../appraisal-select';
import type { ExamQuestionDefinition } from '@/services/examination.service';
export default function QuestionEditor({
  question: q,
  index,
  disabled,
  onChange,
  onRemove,
}: {
  question: ExamQuestionDefinition;
  index: number;
  disabled: boolean;
  onChange: (q: ExamQuestionDefinition) => void;
  onRemove: () => void;
}) {
  const n = index + 1;
  return (
    <fieldset
      disabled={disabled}
      className="min-w-0 space-y-3 rounded-xl border border-gray-200 p-4"
    >
      <legend className="px-1 text-sm font-semibold">Question {n}</legend>
      <label className="block text-sm">
        Question {n}
        <textarea
          maxLength={500}
          value={q.prompt}
          onChange={(e) => onChange({ ...q, prompt: e.target.value })}
          className="mt-1 w-full rounded-lg border border-gray-200 p-2"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-xs text-gray-500">
          Marks for question {n}
          <input
            type="number"
            min={1}
            max={20}
            step={1}
            value={q.marks ?? 2}
            onChange={(e) => onChange({ ...q, marks: Number(e.target.value) })}
            className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900"
          />
        </label>
        <AppraisalSelect
          label={`Difficulty for question ${n}`}
          value={q.difficulty ?? ''}
          disabled={disabled}
          onChange={(value) =>
            onChange({
              ...q,
              difficulty: value
                ? (value as 'easy' | 'medium' | 'hard')
                : undefined,
            })
          }
          options={[
            { value: '', label: 'Not specified' },
            { value: 'easy', label: 'Easy', description: 'AI default: 1 mark' },
            {
              value: 'medium',
              label: 'Medium',
              description: 'AI default: 2 marks',
            },
            {
              value: 'hard',
              label: 'Hard',
              description: 'AI default: 3 marks',
            },
          ]}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {q.options.map((option, i) => (
          <label key={i} className="text-xs text-gray-500">
            Question {n} option {i + 1}
            <input
              maxLength={300}
              value={option}
              onChange={(e) =>
                onChange({
                  ...q,
                  options: q.options.map((o, j) =>
                    j === i ? e.target.value : o
                  ),
                })
              }
              className="mt-1 block w-full rounded-lg border border-gray-200 p-2 text-sm text-gray-900"
            />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full min-w-0 sm:max-w-sm">
          <AppraisalSelect
            label={`Correct answer for question ${n}`}
            value={String(q.correctOption)}
            disabled={disabled}
            showSelectedDescription
            onChange={(value) =>
              onChange({ ...q, correctOption: Number(value) })
            }
            options={q.options.map((answer, i) => ({
              value: String(i),
              label: `Option ${i + 1}`,
              description: answer.trim() || 'Write this answer option above',
            }))}
          />
        </div>
        <button
          type="button"
          disabled={q.options.length >= 6}
          onClick={() => onChange({ ...q, options: [...q.options, ''] })}
          className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
        >
          Add option
        </button>
        <button
          type="button"
          disabled={q.options.length <= 2}
          onClick={() =>
            onChange({
              ...q,
              options: q.options.slice(0, -1),
              correctOption: Math.min(q.correctOption, q.options.length - 2),
            })
          }
          className="rounded-lg border px-3 py-2 text-xs disabled:opacity-40"
        >
          Remove last option
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-red-700 underline"
        >
          Remove question {n}
        </button>
      </div>
    </fieldset>
  );
}
