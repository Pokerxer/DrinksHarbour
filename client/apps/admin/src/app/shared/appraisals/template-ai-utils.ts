import type { DraftQuestion, DraftSection, FeedbackKind } from '@/services/appraisal.service';

/**
 * Pure insert/merge helpers for AI-generated template content.
 *
 * Kept out of the editor component on purpose: every one of these runs inside
 * a single `setSections` call so one generation is ONE undoable step in
 * `use-undo-redo.ts`. Splitting a generation across several setState calls
 * would make Cmd+Z peel it off a section at a time.
 *
 * None of these mutate their input — the undo stack holds the previous array
 * by reference, so mutating it in place would corrupt history.
 */

const KIND_ORDER: FeedbackKind[] = ['self', 'manager', 'peer'];

function labelKey(label: string | undefined): string {
  return (label || '').trim().toLowerCase();
}

/** Lowercased, trimmed labels already present in the draft. Blanks excluded. */
export function existingQuestionLabels(sections: DraftSection[]): Set<string> {
  const out = new Set<string>();
  for (const section of sections || []) {
    for (const question of section?.questions || []) {
      const key = labelKey(question?.label);
      if (key) out.add(key);
    }
  }
  return out;
}

export function countQuestions(sections: DraftSection[]): number {
  return (sections || []).reduce((n, s) => n + (s?.questions?.length || 0), 0);
}

/** Which reviewer kinds a draft actually asks, in canonical order. */
export function summarizeAudiences(sections: DraftSection[]): FeedbackKind[] {
  const seen = new Set<FeedbackKind>();
  for (const section of sections || []) {
    for (const question of section?.questions || []) {
      for (const kind of question?.askOf || []) seen.add(kind);
    }
  }
  return KIND_ORDER.filter((k) => seen.has(k));
}

/**
 * Generated content arrives with no `_id` — the server mints one on save, and
 * that id is the question's identity across template versions and across
 * reviewer kinds. Strip anything an over-helpful model invented.
 */
function cleanQuestion(question: DraftQuestion): DraftQuestion {
  const { _id: _dropped, ...rest } = question as DraftQuestion & { _id?: string };
  return rest as DraftQuestion;
}

/**
 * Drop incoming questions whose label already appears in `seen`, and dedupe
 * the incoming sections against each other. `seen` is MUTATED so successive
 * calls stay consistent. Sections left with nothing are removed.
 *
 * The server sanitizer dedupes too; this is the second line of defence, for
 * the case that matters more — the model was told about the draft but repeated
 * a question anyway, and HR is about to see the preview.
 */
export function stripDuplicateQuestions(
  incoming: DraftSection[],
  seen: Set<string>
): DraftSection[] {
  const out: DraftSection[] = [];
  for (const section of incoming || []) {
    const questions: DraftQuestion[] = [];
    for (const question of section?.questions || []) {
      const key = labelKey(question?.label);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      questions.push(cleanQuestion(question));
    }
    if (questions.length) out.push({ title: section.title, questions });
  }
  return out;
}

/**
 * True when the draft is still the untouched starting skeleton — one section,
 * no title, one unnamed question. Appending below that leaves an empty section
 * the save path then rejects, so callers replace it instead.
 */
export function isBlankDraft(sections: DraftSection[]): boolean {
  if (!sections || sections.length === 0) return true;
  if (sections.length > 1) return false;
  const [only] = sections;
  if ((only.title || '').trim()) return false;
  const questions = only.questions || [];
  if (questions.length > 1) return false;
  return questions.every((q) => !(q.label || '').trim());
}

/** Append generated sections to the draft, replacing it if nothing was authored yet. */
export function appendGeneratedSections(
  current: DraftSection[],
  generated: DraftSection[]
): DraftSection[] {
  const base = isBlankDraft(current) ? [] : current;
  const cleaned = stripDuplicateQuestions(generated, existingQuestionLabels(base));
  return [...base, ...cleaned];
}

/** Add generated questions to the end of one existing section. */
export function appendQuestionsToSection(
  current: DraftSection[],
  sectionIndex: number,
  questions: DraftQuestion[]
): DraftSection[] {
  if (!current || sectionIndex < 0 || sectionIndex >= current.length) return current;

  const seen = existingQuestionLabels(current);
  const additions = (questions || [])
    .filter((q) => {
      const key = labelKey(q?.label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(cleanQuestion);
  if (additions.length === 0) return current;

  return current.map((section, i) => {
    if (i !== sectionIndex) return section;
    // A section still holding only its unnamed placeholder gets replaced
    // rather than padded — otherwise the save path rejects the blank label.
    const kept = (section.questions || []).filter((q) => (q.label || '').trim());
    return { ...section, questions: [...kept, ...additions] };
  });
}

/**
 * Swap in an AI-assisted rewrite of one question, keeping its `_id`. Stored
 * answers reference that id, so a rewrite must never orphan them.
 */
export function applyQuestionAssist(
  current: DraftSection[],
  sectionIndex: number,
  questionIndex: number,
  next: DraftQuestion
): DraftSection[] {
  if (!current || sectionIndex < 0 || sectionIndex >= current.length) return current;
  const questions = current[sectionIndex].questions || [];
  if (questionIndex < 0 || questionIndex >= questions.length) return current;

  const existingId = (questions[questionIndex] as DraftQuestion & { _id?: string })._id;
  const replacement = cleanQuestion(next);

  return current.map((section, i) =>
    i !== sectionIndex
      ? section
      : {
          ...section,
          questions: section.questions.map((q, j) =>
            j !== questionIndex ? q : existingId ? { ...replacement, _id: existingId } : replacement
          ),
        }
  );
}

/**
 * Stamp a department onto freshly generated sections (Phase 5 §9.1).
 *
 * `''` leaves them company-wide — `departments: []` explicitly, not absent,
 * so the editor's scope pill reads "Everyone" from a real value rather than
 * from a missing key it has to guess about.
 *
 * Only ever applied to sections the model just produced. An existing section
 * already carries an audience HR chose; re-scoping it because they typed a
 * department into the generator would silently change who answers questions
 * that are already on the form.
 */
export function scopeSections<T extends { departments?: string[] }>(
  sections: T[],
  departmentId: string
): T[] {
  return (sections || []).map((section) => ({
    ...section,
    departments: departmentId ? [departmentId] : [],
  }));
}
