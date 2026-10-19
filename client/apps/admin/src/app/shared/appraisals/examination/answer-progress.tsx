import type { OwnExamination } from '@/services/examination.service';
export default function AnswerProgress({
  questions,
  answers,
  onNavigate,
  disabled,
}: {
  questions: NonNullable<OwnExamination['questions']>;
  answers: Record<string, number>;
  onNavigate: (index: number) => void;
  disabled: boolean;
}) {
  const answered = questions.filter(
    (q) => answers[q.question] !== undefined
  ).length;
  const next = questions.findIndex((q) => answers[q.question] === undefined);
  return (
    <nav
      className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4"
      aria-label="Examination questions"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900">
          {answered} of {questions.length} answered
        </p>
        <p className="text-xs text-gray-500">
          {questions.length - answered} remaining
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Examination completion"
        aria-valuemin={0}
        aria-valuemax={questions.length}
        aria-valuenow={answered}
        className="h-1.5 overflow-hidden rounded-full bg-gray-200"
      >
        <div
          className="h-full rounded-full bg-[#b20202]"
          style={{
            width: `${questions.length ? (answered / questions.length) * 100 : 0}%`,
          }}
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {questions.map((q, i) => (
          <button
            key={q.question}
            type="button"
            disabled={disabled}
            onClick={() => onNavigate(i)}
            aria-label={`Go to question ${i + 1}${answers[q.question] !== undefined ? ', answered' : ', unanswered'}`}
            className={`h-9 min-w-9 rounded-lg border px-2 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b20202] disabled:opacity-40 ${answers[q.question] !== undefined ? 'border-[#b20202] bg-[#b20202] text-white' : 'border-gray-300 bg-white text-gray-600 hover:border-gray-500'}`}
          >
            {i + 1}
          </button>
        ))}
      </div>
      {next >= 0 && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onNavigate(next)}
          className="text-xs font-medium text-[#b20202] underline disabled:opacity-40"
        >
          Go to next unanswered question
        </button>
      )}
    </nav>
  );
}
