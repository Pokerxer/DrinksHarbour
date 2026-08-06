import { describe, expect, it } from 'vitest';
import {
  appendGeneratedSections,
  applyQuestionAssist,
  appendQuestionsToSection,
  countQuestions,
  isBlankDraft,
  existingQuestionLabels,
  stripDuplicateQuestions,
  summarizeAudiences,
} from './template-ai-utils';
import type { DraftQuestion, DraftSection } from '@/services/appraisal.service';

const ALL: DraftQuestion['askOf'] = ['self', 'manager', 'peer'];

function q(label: string, extra: Partial<DraftQuestion> = {}): DraftQuestion {
  return { type: 'rating', label, required: true, scaleMax: 5, askOf: ALL, ...extra };
}

function s(title: string, labels: string[]): DraftSection {
  return { title, questions: labels.map((l) => q(l)) };
}

const BLANK: DraftSection[] = [
  { title: '', questions: [{ type: 'rating', label: '', required: true, scaleMax: 5, askOf: ALL }] },
];

// ---------------------------------------------------------------------------
// isBlankDraft
// ---------------------------------------------------------------------------
describe('isBlankDraft', () => {
  it('recognises the untouched starting draft', () => {
    expect(isBlankDraft(BLANK)).toBe(true);
    expect(isBlankDraft([])).toBe(true);
  });

  it('is false once HR has typed anything', () => {
    expect(isBlankDraft([{ title: 'Competencies', questions: BLANK[0].questions }])).toBe(false);
    expect(isBlankDraft([s('', ['Communication'])])).toBe(false);
    expect(isBlankDraft([...BLANK, ...BLANK])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// appendGeneratedSections
// ---------------------------------------------------------------------------
describe('appendGeneratedSections', () => {
  it('replaces an untouched blank draft instead of appending below it', () => {
    const out = appendGeneratedSections(BLANK, [s('Competencies', ['Communication'])]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Competencies');
  });

  it('appends after real work rather than clobbering it', () => {
    const current = [s('Goals', ['Hit quarterly target'])];
    const out = appendGeneratedSections(current, [s('Competencies', ['Communication'])]);
    expect(out.map((x) => x.title)).toEqual(['Goals', 'Competencies']);
  });

  it('does not mutate the draft it was given', () => {
    const current = [s('Goals', ['Hit quarterly target'])];
    appendGeneratedSections(current, [s('Competencies', ['Communication'])]);
    expect(current).toHaveLength(1);
  });

  it('drops incoming questions whose label already exists, case-insensitively', () => {
    const current = [s('Goals', ['Communication'])];
    const out = appendGeneratedSections(current, [
      s('Competencies', ['  COMMUNICATION  ', 'Ownership']),
    ]);
    expect(out[1].questions.map((x) => x.label)).toEqual(['Ownership']);
  });

  it('drops an incoming section left with no questions after dedupe', () => {
    const current = [s('Goals', ['Communication'])];
    const out = appendGeneratedSections(current, [s('Competencies', ['communication'])]);
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe('Goals');
  });

  it('never carries an _id in from generated content', () => {
    const generated = [
      { title: 'Competencies', questions: [q('Communication', { _id: 'not-ours' } as never)] },
    ] as DraftSection[];
    const out = appendGeneratedSections(BLANK, generated);
    expect(out[0].questions[0]).not.toHaveProperty('_id');
  });
});

// ---------------------------------------------------------------------------
// appendQuestionsToSection
// ---------------------------------------------------------------------------
describe('appendQuestionsToSection', () => {
  it('adds the new questions to the end of the named section only', () => {
    const current = [s('Goals', ['A']), s('Competencies', ['B'])];
    const out = appendQuestionsToSection(current, 1, [q('C'), q('D')]);
    expect(out[0].questions.map((x) => x.label)).toEqual(['A']);
    expect(out[1].questions.map((x) => x.label)).toEqual(['B', 'C', 'D']);
  });

  it('skips questions that duplicate one anywhere in the form', () => {
    const current = [s('Goals', ['A']), s('Competencies', ['B'])];
    const out = appendQuestionsToSection(current, 1, [q('a'), q('C')]);
    expect(out[1].questions.map((x) => x.label)).toEqual(['B', 'C']);
  });

  it('drops the section placeholder question when the section was still blank', () => {
    const current: DraftSection[] = [{ title: 'Competencies', questions: [q('')] }];
    const out = appendQuestionsToSection(current, 0, [q('C')]);
    expect(out[0].questions.map((x) => x.label)).toEqual(['C']);
  });

  it('returns the draft untouched for an out-of-range index', () => {
    const current = [s('Goals', ['A'])];
    expect(appendQuestionsToSection(current, 7, [q('C')])).toBe(current);
    expect(appendQuestionsToSection(current, -1, [q('C')])).toBe(current);
  });
});

// ---------------------------------------------------------------------------
// applyQuestionAssist
// ---------------------------------------------------------------------------
describe('applyQuestionAssist', () => {
  it('replaces exactly one question and leaves its neighbours alone', () => {
    const current = [s('Goals', ['A', 'B'])];
    const out = applyQuestionAssist(current, 0, 1, q('B rewritten'));
    expect(out[0].questions.map((x) => x.label)).toEqual(['A', 'B rewritten']);
  });

  it('preserves the existing _id — answers already reference it', () => {
    const current: DraftSection[] = [
      { title: 'Goals', questions: [q('A', { _id: 'q-1' } as never)] },
    ];
    const out = applyQuestionAssist(current, 0, 0, q('A rewritten'));
    expect((out[0].questions[0] as { _id?: string })._id).toBe('q-1');
  });

  it('returns the draft untouched for an out-of-range index', () => {
    const current = [s('Goals', ['A'])];
    expect(applyQuestionAssist(current, 0, 4, q('X'))).toBe(current);
    expect(applyQuestionAssist(current, 3, 0, q('X'))).toBe(current);
  });
});

// ---------------------------------------------------------------------------
// Helpers used by the preview panel
// ---------------------------------------------------------------------------
describe('countQuestions', () => {
  it('totals questions across sections', () => {
    expect(countQuestions([s('A', ['1', '2']), s('B', ['3'])])).toBe(3);
    expect(countQuestions([])).toBe(0);
  });
});

describe('existingQuestionLabels', () => {
  it('collects trimmed lowercased labels and ignores blanks', () => {
    const set = existingQuestionLabels([s('A', ['  Communication ', '']), s('B', ['Ownership'])]);
    expect(Array.from(set).sort()).toEqual(['communication', 'ownership']);
  });
});

describe('stripDuplicateQuestions', () => {
  it('dedupes within the incoming sections too, not only against the draft', () => {
    const out = stripDuplicateQuestions([s('A', ['One', 'one', 'Two'])], new Set());
    expect(out[0].questions.map((x) => x.label)).toEqual(['One', 'Two']);
  });
});

describe('summarizeAudiences', () => {
  it('reads back the reviewer kinds a generated draft actually asks', () => {
    const sections = [
      { title: 'A', questions: [q('1', { askOf: ['self', 'manager'] })] },
      { title: 'B', questions: [q('2', { askOf: ['peer'] })] },
    ];
    expect(summarizeAudiences(sections)).toEqual(['self', 'manager', 'peer']);
  });

  it('is empty for an empty draft', () => {
    expect(summarizeAudiences([])).toEqual([]);
  });
});
