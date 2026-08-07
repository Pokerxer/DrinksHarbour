import type { DraftQuestion, DraftSection } from '@/services/appraisal.service';

/**
 * Stable client-side identity for draft sections and questions.
 *
 * The editor used the array index as the React key. Both `TemplateSectionCard`
 * and `TemplateQuestionRow` hold their own `collapsed` (and the row also
 * `assistOpen`) state, and an index key binds that state — plus the caret in
 * whichever input has focus — to the POSITION rather than to the item. Delete
 * the second of four questions and the third slides up wearing the second's
 * collapsed state; reorder two sections and `motion.div layout` has no element
 * to animate because nothing moved as far as React is concerned.
 *
 * A saved item already has a server `_id`, but a newly added one has none
 * until the next save, and that is exactly when reordering happens. So every
 * draft item carries `_uid`, minted here and never sent to the server:
 * `stripDraftKeys` removes it on the way out. `_id` is deliberately NOT reused
 * as the key even when present — a duplicated question briefly shares its
 * source's `_id`-less shape, and mixing two key sources invites collisions.
 */

/** A draft item with client-side identity attached. */
export type Keyed<T> = T & { _uid: string };
export type KeyedQuestion = Keyed<DraftQuestion>;
export type KeyedSection = Keyed<Omit<DraftSection, 'questions'>> & {
  questions: KeyedQuestion[];
};

let counter = 0;

/**
 * Unique for the lifetime of the page, which is all a React key needs. Not
 * `crypto.randomUUID()`: this runs during render paths that also execute on
 * the server for the first paint, where the API is not guaranteed.
 */
export function newUid(): string {
  counter += 1;
  return `d${counter}`;
}

function hasUid(value: unknown): boolean {
  return typeof (value as { _uid?: unknown })?._uid === 'string';
}

/**
 * Attach `_uid` to anything missing one, preserving every uid already there.
 *
 * Returns the SAME array reference when nothing needed changing. That matters:
 * the undo reducer skips a set whose result is `Object.is`-identical to the
 * present, so a re-normalisation that changed nothing must not register as an
 * undoable edit.
 */
export function ensureDraftKeys(sections: DraftSection[]): KeyedSection[] {
  let sectionsChanged = false;
  const next = (sections || []).map((section) => {
    let questionsChanged = false;
    const questions = (section?.questions || []).map((question) => {
      if (hasUid(question)) return question as KeyedQuestion;
      questionsChanged = true;
      return { ...question, _uid: newUid() } as KeyedQuestion;
    });
    if (hasUid(section) && !questionsChanged) return section as KeyedSection;
    sectionsChanged = true;
    return {
      ...section,
      _uid: hasUid(section) ? (section as KeyedSection)._uid : newUid(),
      questions,
    } as KeyedSection;
  });
  return sectionsChanged ? next : (sections as KeyedSection[]);
}

/**
 * Drop every `_uid` before the draft goes on the wire.
 *
 * Mongoose would ignore an unknown subdocument path anyway, but the template
 * endpoints echo what they were sent back into the editor, and a field that
 * exists only because it survived a round trip is the kind of thing that
 * quietly becomes load-bearing.
 */
export function stripDraftKeys(sections: KeyedSection[]): DraftSection[] {
  return (sections || []).map(({ _uid: _s, questions, ...section }) => ({
    ...section,
    questions: (questions || []).map(({ _uid: _q, ...question }) => question),
  }));
}

/** A fresh uid for a copy, so a duplicate is its own item immediately. */
export function reKey<T extends object>(item: T): Keyed<T> {
  return { ...item, _uid: newUid() };
}
