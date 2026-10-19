'use client';
import { useEffect, useRef, useState } from 'react';
import {
  fetchQuestionBank,
  generateExamQuestions,
  type QuestionBankDraft,
  type QuestionBankOption,
} from '@/services/examination.service';
export default function QuestionSources({
  cycleId,
  banks = [],
  disabled,
  onUse,
  onBusy,
}: {
  cycleId: string;
  banks?: QuestionBankOption[];
  disabled: boolean;
  onUse: (bank: QuestionBankDraft) => void;
  onBusy: (busy: boolean) => void;
}) {
  const [topic, setTopic] = useState(''),
    [count, setCount] = useState(30);
  const [draft, setDraft] = useState<QuestionBankDraft | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [message, setMessage] = useState('');
  const lock = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function load(bankId?: string) {
    if (lock.current || disabled) return;
    lock.current = true;
    setBusy(true);
    onBusy(true);
    setError('');
    setMessage('');
    try {
      const result = bankId
        ? await fetchQuestionBank(cycleId, bankId)
        : await generateExamQuestions(cycleId, topic, count);
      if (!active.current) return;
      if (bankId) {
        onUse(result);
        setMessage(`${result.questions.length} questions loaded`);
      } else setDraft(result);
    } catch (e) {
      if (active.current)
        setError(
          e instanceof Error ? e.message : 'Could not load the question bank.'
        );
    } finally {
      lock.current = false;
      if (active.current) {
        setBusy(false);
        onBusy(false);
      }
    }
  }
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <h3 className="text-sm font-semibold">2. Choose your question source</h3>
      {banks.map((bank) => (
        <div
          key={bank.id}
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-white p-4"
        >
          <div>
            <p className="text-sm font-semibold text-gray-900">{bank.name}</p>
            <p className="mt-1 text-xs text-gray-500">
              {bank.questionCount} supplied questions · management answer key
              included
            </p>
          </div>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => load(bank.id)}
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Use Wyn City question bank
          </button>
        </div>
      ))}
      <p className="text-xs leading-5 text-gray-500">
        Loading a bank replaces the questions in this draft. Review the correct
        answers before saving.
      </p>
      <details className="rounded-xl border border-gray-200 bg-white p-4" open>
        <summary className="cursor-pointer text-sm font-semibold">
          Generate with AI
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-xs leading-5 text-gray-500">
            AI assigns easy questions 1 mark, medium 2 marks and hard 3 marks.
            You can edit every mark before saving.
          </p>
          <label className="block text-xs font-medium text-gray-600">
            Topics for AI questions
            <textarea
              maxLength={1500}
              value={topic}
              disabled={busy || disabled}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="For example: wine, spirits, product knowledge and customer service"
              className="mt-1 w-full rounded-lg border border-gray-200 p-2.5 text-sm"
            />
          </label>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs text-gray-600">
              Questions to generate
              <input
                type="number"
                min={10}
                max={50}
                value={count}
                disabled={busy || disabled}
                onChange={(e) => setCount(Number(e.target.value))}
                className="mt-1 block w-28 rounded-lg border border-gray-200 p-2.5 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={
                busy ||
                disabled ||
                !topic.trim() ||
                !Number.isInteger(count) ||
                count < 10 ||
                count > 50
              }
              onClick={() => load()}
              className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium disabled:opacity-40"
            >
              {busy ? 'Preparing questions…' : 'Generate draft questions'}
            </button>
          </div>
        </div>
      </details>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-xs text-green-700">
          {message}
        </p>
      )}
      {draft && (
        <section
          className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4"
          aria-label="AI question draft"
        >
          <div className="flex flex-wrap justify-between gap-2">
            <h4 className="text-sm font-semibold">
              Review {draft.questions.length} generated questions
            </h4>
            <span className="text-xs text-gray-500">Model: {draft.model}</span>
          </div>
          <p className="text-xs leading-5 text-amber-900">
            AI can make mistakes. Review the questions and correct answers.
            Nothing is saved or published until you accept the draft and save
            examination settings.
          </p>
          <div className="max-h-64 space-y-2 overflow-y-auto">
            {draft.questions.map((q, i) => (
              <details key={i} className="rounded-lg bg-white p-3 text-xs">
                <summary className="cursor-pointer font-medium">
                  {i + 1}. {q.prompt} · {q.difficulty} · {q.marks} marks
                </summary>
                <ol className="mt-2 list-inside list-[upper-alpha] space-y-1">
                  {q.options.map((o, j) => (
                    <li key={j}>
                      {o}
                      {q.correctOption === j ? ' · Correct answer' : ''}
                    </li>
                  ))}
                </ol>
              </details>
            ))}
          </div>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              onUse(draft);
              setDraft(null);
              setMessage(
                `${draft.questions.length} generated questions loaded · Model: ${draft.model}`
              );
            }}
            className="rounded-lg bg-[#b20202] px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Use generated questions
          </button>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => setDraft(null)}
            className="ml-3 text-xs underline"
          >
            Discard generated draft
          </button>
        </section>
      )}
    </div>
  );
}
