import { describe, expect, it } from 'vitest';
import { TEMPLATE_PRESETS } from './template-presets';
import { sectionAppliesTo } from './section-scope-utils';
import type {
  DraftQuestion,
  DraftSection,
  FeedbackKind,
  QuestionType,
} from '@/services/appraisal.service';

/**
 * Mirrors COMPARABLE_QUESTION_TYPES in server/services/appraisal.helpers.js —
 * the only types buildComparison will put side by side. `yes_no` stores a
 * number but is deliberately excluded there, so it is excluded here too.
 */
const COMPARABLE: QuestionType[] = ['rating', 'likert', 'scale'];

/**
 * Mirrors filterSections in server/services/appraisal.helpers.js.
 *
 * Carries the Phase 5 department rule and the job-role rule with it: a section
 * naming departments is asked only of an employee in one of them, a section
 * naming roles only of a holder of one of them, the two are ANDed, and an
 * empty/absent list on either means everyone. Every preset ships company-wide
 * sections, so `departmentId` and `roleIds` are omitted below — but the mirror
 * has to model the real function, or it stops being a check on the presets and
 * becomes a check on a function that no longer exists.
 *
 * The scope test itself is `sectionAppliesTo` in ./section-scope-utils, which
 * the editor also uses; only the askOf half is written out here. One mirror,
 * not two.
 */
function filterSections(
  sections: DraftSection[],
  {
    kind,
    departmentId,
    roleIds,
  }: { kind: FeedbackKind; departmentId?: string; roleIds?: string[] }
): DraftSection[] {
  return sections
    .filter((s) => sectionAppliesTo(s, { departmentId, roleIds }))
    .map((s) => ({
      ...s,
      questions: s.questions.filter((q) => (q.askOf || []).includes(kind)),
    }))
    .filter((s) => s.questions.length > 0);
}

function allQuestions(sections: DraftSection[]): DraftQuestion[] {
  return sections.flatMap((s) => s.questions);
}

function preset(id: string) {
  const found = TEMPLATE_PRESETS.find((p) => p.id === id);
  if (!found) throw new Error(`No preset with id ${id}`);
  return found;
}

describe('template presets', () => {
  it('declares a questionCount matching the sections it ships', () => {
    for (const p of TEMPLATE_PRESETS) {
      expect(p.questionCount, p.id).toBe(allQuestions(p.sections).length);
    }
  });

  it('never scopes a question to a kind the preset does not claim to serve', () => {
    for (const p of TEMPLATE_PRESETS) {
      for (const q of allQuestions(p.sections)) {
        expect(q.askOf.length, `${p.id} / ${q.label}`).toBeGreaterThan(0);
        for (const kind of q.askOf) {
          expect(p.audiences, `${p.id} / ${q.label}`).toContain(kind);
        }
      }
    }
  });
});

/**
 * A 360 is defined by comparing a subject's self-rating against how their
 * manager and peers rate them on the SAME competency. buildComparison can only
 * pair up answers of a comparable type keyed to one shared question id, so a
 * scored competency the subject is never asked produces no gap at all — the
 * one number the whole exercise exists to produce. These are contracts on the
 * preset's authoring, not on any rendering code.
 */
describe('the 360° Feedback preset', () => {
  const threeSixty = preset('three-sixty');
  const scored = allQuestions(threeSixty.sections).filter((q) =>
    COMPARABLE.includes(q.type)
  );

  it('asks the subject every competency it asks a rater to score', () => {
    const missingSelf = scored
      .filter((q) => !q.askOf.includes('self'))
      .map((q) => q.label);
    expect(missingSelf).toEqual([]);
  });

  it('asks at least one rater about every competency it asks the subject to score', () => {
    const selfOnly = scored
      .filter((q) => !q.askOf.some((k) => k === 'manager' || k === 'peer'))
      .map((q) => q.label);
    expect(selfOnly).toEqual([]);
  });

  it('puts every section on the self-assessment form', () => {
    const selfSections = filterSections(threeSixty.sections, { kind: 'self' });
    expect(selfSections.map((s) => s.title)).toEqual(
      threeSixty.sections.map((s) => s.title)
    );
  });
});
