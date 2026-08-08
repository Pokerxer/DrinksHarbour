import { describe, expect, it } from 'vitest';
import {
  departmentsUsedBySections,
  describeSectionAudience,
  sectionAppliesToDepartment,
  toggleSectionDepartment,
  type DepartmentOption,
} from './section-departments-utils';

const OPTIONS: DepartmentOption[] = [
  { _id: 'd-sales', name: 'Sales' },
  { _id: 'd-ops', name: 'Operations' },
  { _id: 'd-fin', name: 'Finance' },
  { _id: 'd-hr', name: 'People' },
];

describe('toggleSectionDepartment', () => {
  it('adds a department that is not yet on the section', () => {
    expect(toggleSectionDepartment(['d-sales'], 'd-ops')).toEqual([
      'd-sales',
      'd-ops',
    ]);
  });

  it('removes one that is', () => {
    expect(toggleSectionDepartment(['d-sales', 'd-ops'], 'd-sales')).toEqual([
      'd-ops',
    ]);
  });

  it('treats an absent list as empty rather than throwing', () => {
    expect(toggleSectionDepartment(undefined, 'd-sales')).toEqual(['d-sales']);
  });

  it('returns a new array so the undo stack can see the change', () => {
    const before = ['d-sales'];
    const after = toggleSectionDepartment(before, 'd-ops');
    expect(after).not.toBe(before);
    expect(before).toEqual(['d-sales']);
  });
});

describe('describeSectionAudience', () => {
  it('reads EMPTY as everyone, not as nobody', () => {
    // The whole trap: a multi-select with nothing ticked normally means an
    // empty result set. Here it means the opposite, and the label has to say so.
    expect(describeSectionAudience([], OPTIONS)).toBe('Everyone');
    expect(describeSectionAudience(undefined, OPTIONS)).toBe('Everyone');
  });

  it('names the departments while the list is short enough to scan', () => {
    expect(describeSectionAudience(['d-sales'], OPTIONS)).toBe('Sales');
    expect(describeSectionAudience(['d-sales', 'd-ops'], OPTIONS)).toBe(
      'Sales, Operations'
    );
  });

  it('collapses to a count once naming them stops being scannable', () => {
    expect(
      describeSectionAudience(['d-sales', 'd-ops', 'd-fin', 'd-hr'], OPTIONS)
    ).toBe('4 departments');
  });

  it('reports a department that no longer exists rather than dropping it', () => {
    // Silently narrowing the label is the change HR would never notice.
    expect(describeSectionAudience(['d-sales', 'd-gone'], OPTIONS)).toBe(
      'Sales, 1 unknown'
    );
    expect(describeSectionAudience(['d-gone'], OPTIONS)).toBe('1 unknown');
  });
});

describe('sectionAppliesToDepartment', () => {
  it('a company-wide section applies to everyone, including someone with no department', () => {
    expect(sectionAppliesToDepartment([], 'd-sales')).toBe(true);
    expect(sectionAppliesToDepartment(undefined, null)).toBe(true);
  });

  it('a scoped section applies only inside its departments', () => {
    expect(sectionAppliesToDepartment(['d-sales'], 'd-sales')).toBe(true);
    expect(sectionAppliesToDepartment(['d-sales'], 'd-ops')).toBe(false);
  });

  it('a scoped section never applies to an employee with no department', () => {
    expect(sectionAppliesToDepartment(['d-sales'], null)).toBe(false);
    expect(sectionAppliesToDepartment(['d-sales'], undefined)).toBe(false);
  });
});

describe('departmentsUsedBySections', () => {
  it('returns only the departments some section actually singles out, in option order', () => {
    const sections = [
      { departments: ['d-ops'] },
      { departments: [] },
      { departments: ['d-sales', 'd-ops'] },
      {},
    ];
    expect(departmentsUsedBySections(sections, OPTIONS)).toEqual([
      { _id: 'd-sales', name: 'Sales' },
      { _id: 'd-ops', name: 'Operations' },
    ]);
  });

  it('is empty for a wholly company-wide form', () => {
    expect(departmentsUsedBySections([{ departments: [] }, {}], OPTIONS)).toEqual(
      []
    );
  });
});
