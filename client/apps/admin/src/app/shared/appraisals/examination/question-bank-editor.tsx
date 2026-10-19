'use client';
import { useId, useState } from 'react';
import type { ExamConfiguration } from '@/services/examination.service';
import AppraisalSelect from '../appraisal-select';
import QuestionEditor from './question-editor';
import { emptyQuestion } from './use-exam-setup';
export default function QuestionBankEditor({
  config,
  disabled,
  onChange,
}: {
  config: ExamConfiguration;
  disabled: boolean;
  onChange: (next: ExamConfiguration) => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(0);
  const id = useId();
  const [query, setQuery] = useState(''),
    [difficulty, setDifficulty] = useState('all');
  const visible = config.questions
    .map((q, i) => ({ q, i }))
    .filter(
      ({ q }) =>
        (difficulty === 'all' ||
          (q.difficulty ?? 'unspecified') === difficulty) &&
        [q.prompt, ...q.options]
          .join(' ')
          .toLowerCase()
          .includes(query.trim().toLowerCase())
    );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">3. Review your question bank</h3>
        <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium">
          {config.questions.length} questions in bank
        </span>
      </div>
      <p className="text-xs leading-5 text-gray-500">
        Each employee receives 10 randomly selected questions in a shuffled
        order. Their paper stays fixed after launch. Correct answers are visible
        only to management.
      </p>
      {config.questions.length < 10 && (
        <p className="text-xs text-amber-700">
          Add or load at least 10 questions before saving.
        </p>
      )}
      <div className="grid gap-3 rounded-xl bg-gray-50 p-3 sm:grid-cols-[minmax(0,1fr)_180px]">
        <label className="text-xs font-medium text-gray-600">
          Search question bank
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search questions or answer options"
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white p-2.5 text-sm text-gray-900 focus:border-[#b20202] focus:ring-[#b20202]"
          />
        </label>
        <AppraisalSelect
          label="Filter by difficulty"
          value={difficulty}
          onChange={setDifficulty}
          disabled={disabled}
          options={[
            { value: 'all', label: 'All difficulties' },
            { value: 'easy', label: 'Easy' },
            { value: 'medium', label: 'Medium' },
            { value: 'hard', label: 'Hard' },
            { value: 'unspecified', label: 'Not specified' },
          ]}
        />
      </div>
      <div className="flex items-center justify-between gap-2 text-xs text-gray-500">
        <p role="status">
          Showing {visible.length} of {config.questions.length} questions
        </p>
        {(query || difficulty !== 'all') && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setDifficulty('all');
            }}
            className="font-medium text-gray-700 underline"
          >
            Clear filters
          </button>
        )}
      </div>
      {!visible.length && (
        <p className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
          No questions match your filters.
        </p>
      )}
      <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
        {visible.map(({ q, i }) => (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-gray-200 bg-white"
          >
            <button
              type="button"
              disabled={disabled}
              aria-expanded={expanded === i}
              aria-controls={`${id}-${i}`}
              onClick={() => setExpanded(expanded === i ? null : i)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-gray-50"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-semibold text-gray-500">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate font-medium text-gray-800">
                {q.prompt || 'Write a new question'}
              </span>
              {q.difficulty && (
                <span className="hidden rounded-full bg-gray-100 px-2 py-1 text-[10px] capitalize text-gray-600 sm:inline">
                  {q.difficulty}
                </span>
              )}
              <span className="shrink-0 text-xs text-gray-500">
                {q.marks ?? config.marksPerQuestion ?? 2}{' '}
                {(q.marks ?? config.marksPerQuestion ?? 2) === 1
                  ? 'mark'
                  : 'marks'}
              </span>
              <span className="text-gray-400">
                {expanded === i ? '−' : '+'}
              </span>
            </button>
            {expanded === i && (
              <div id={`${id}-${i}`} className="border-t border-gray-100 p-3">
                <QuestionEditor
                  question={q}
                  index={i}
                  disabled={disabled}
                  onChange={(next) =>
                    onChange({
                      ...config,
                      questions: config.questions.map((old, j) =>
                        i === j ? next : old
                      ),
                    })
                  }
                  onRemove={() => {
                    onChange({
                      ...config,
                      questions: config.questions.filter((_, j) => i !== j),
                    });
                    setExpanded(null);
                  }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || config.questions.length >= 100}
        onClick={() => {
          setQuery('');
          setDifficulty('all');
          setExpanded(config.questions.length);
          onChange({
            ...config,
            questions: [...config.questions, emptyQuestion()],
          });
        }}
        className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium disabled:opacity-40"
      >
        Add question
      </button>
    </div>
  );
}
