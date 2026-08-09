import { describe, expect, it } from 'vitest';
import {
  describeSectionAudience,
  scopeOptionsUsedBySections,
  sectionAppliesTo,
  toggleScopeId,
  type ScopeOption,
} from './section-scope-utils';

const DEPARTMENTS: ScopeOption[] = [
  { _id: 'd-sales', name: 'Sales' },
  { _id: 'd-ops', name: 'Operations' },
  { _id: 'd-fin', name: 'Finance' },
  { _id: 'd-hr', name: 'People' },
];

const ROLES: ScopeOption[] = [
  { _id: 'r-cashier', name: 'Cashier' },
  { _id: 'r-attendant', name: 'Attendant' },
  { _id: 'r-driver', name: 'Driver' },
  { _id: 'r-cleaner', name: 'Cleaner' },
];

describe('toggleScopeId', () => {
  it('adds an id that is not yet on the section', () => {
    expect(toggleScopeId(['d-sales'], 'd-ops')).toEqual(['d-sales', 'd-ops']);
  });

  it('removes one that is', () => {
    expect(toggleScopeId(['d-sales', 'd-ops'], 'd-sales')).toEqual(['d-ops']);
  });

  it('treats an absent list as empty rather than throwing', () => {
    expect(toggleScopeId(undefined, 'd-sales')).toEqual(['d-sales']);
  });

  it('returns a new array so the undo stack can see the change', () => {
    const before = ['d-sales'];
    const after = toggleScopeId(before, 'd-ops');
    expect(after).not.toBe(before);
    expect(before).toEqual(['d-sales']);
  });
});

describe('describeSectionAudience', () => {
  const describe_ = (section: { departments?: string[]; roles?: string[] }) =>
    describeSectionAudience(section, DEPARTMENTS, ROLES);

  it('reads EMPTY as everyone, not as nobody', () => {
    // The whole trap: a multi-select with nothing ticked normally means an
    // empty result set. Here it means the opposite, and the label has to say so.
    expect(describe_({ departments: [], roles: [] })).toBe('Everyone');
    expect(describe_({})).toBe('Everyone');
  });

  it('names the departments while the list is short enough to scan', () => {
    expect(describe_({ departments: ['d-sales'] })).toBe('Sales');
    expect(describe_({ departments: ['d-sales', 'd-ops'] })).toBe(
      'Sales, Operations'
    );
  });

  it('names the roles the same way when only roles are set', () => {
    expect(describe_({ roles: ['r-cashier'] })).toBe('Cashier');
    expect(describe_({ roles: ['r-cashier', 'r-attendant'] })).toBe(
      'Cashier, Attendant'
    );
  });

  it('joins the two dimensions, because the section is asked where they OVERLAP', () => {
    // Read out loud this says "Sales cashiers", which is what the server does.
    // Anything that read as "Sales or cashiers" would describe a wider
    // audience than the section actually has.
    expect(describe_({ departments: ['d-sales'], roles: ['r-cashier'] })).toBe(
      'Sales · Cashier'
    );
  });

  it('collapses each dimension separately once naming them stops being scannable', () => {
    expect(
      describe_({ departments: ['d-sales', 'd-ops', 'd-fin', 'd-hr'] })
    ).toBe('4 departments');
    expect(
      describe_({
        roles: ['r-cashier', 'r-attendant', 'r-driver', 'r-cleaner'],
      })
    ).toBe('4 roles');
  });

  it('reports an option that no longer exists rather than dropping it', () => {
    // Silently narrowing the label is the change HR would never notice, and
    // silently WIDENING it — reading the leftover list as empty, i.e. as
    // everyone — would be worse still.
    expect(describe_({ departments: ['d-sales', 'd-gone'] })).toBe(
      'Sales, 1 unknown'
    );
    expect(describe_({ departments: ['d-gone'] })).toBe('1 unknown');
    expect(describe_({ roles: ['r-gone'] })).toBe('1 unknown');
  });
});

describe('sectionAppliesTo', () => {
  it('a company-wide section applies to everyone, including someone with neither', () => {
    expect(
      sectionAppliesTo({}, { departmentId: 'd-sales', roleIds: ['r-cashier'] })
    ).toBe(true);
    expect(sectionAppliesTo({ departments: [], roles: [] }, {})).toBe(true);
  });

  it('a department-scoped section applies only inside its departments', () => {
    expect(
      sectionAppliesTo(
        { departments: ['d-sales'] },
        { departmentId: 'd-sales' }
      )
    ).toBe(true);
    expect(
      sectionAppliesTo({ departments: ['d-sales'] }, { departmentId: 'd-ops' })
    ).toBe(false);
    expect(
      sectionAppliesTo({ departments: ['d-sales'] }, { departmentId: null })
    ).toBe(false);
  });

  it('a role-scoped section applies only to a holder of one of its roles', () => {
    expect(
      sectionAppliesTo({ roles: ['r-cashier'] }, { roleIds: ['r-cashier'] })
    ).toBe(true);
    expect(
      sectionAppliesTo({ roles: ['r-cashier'] }, { roleIds: ['r-attendant'] })
    ).toBe(false);
    expect(sectionAppliesTo({ roles: ['r-cashier'] }, { roleIds: [] })).toBe(
      false
    );
    expect(sectionAppliesTo({ roles: ['r-cashier'] }, {})).toBe(false);
  });

  it('ANDs the two, so a cashier outside the department is still not asked', () => {
    const section = { departments: ['d-sales'], roles: ['r-cashier'] };
    expect(
      sectionAppliesTo(section, {
        departmentId: 'd-sales',
        roleIds: ['r-cashier'],
      })
    ).toBe(true);
    expect(
      sectionAppliesTo(section, {
        departmentId: 'd-ops',
        roleIds: ['r-cashier'],
      })
    ).toBe(false);
    expect(
      sectionAppliesTo(section, {
        departmentId: 'd-sales',
        roleIds: ['r-attendant'],
      })
    ).toBe(false);
  });
});

describe('scopeOptionsUsedBySections', () => {
  it('returns only the options some section actually singles out, in option order', () => {
    const sections = [
      { departments: ['d-ops'] },
      { departments: [] },
      { departments: ['d-sales', 'd-ops'] },
      {},
    ];
    expect(
      scopeOptionsUsedBySections(sections, 'departments', DEPARTMENTS)
    ).toEqual([
      { _id: 'd-sales', name: 'Sales' },
      { _id: 'd-ops', name: 'Operations' },
    ]);
  });

  it('reads the roles key the same way', () => {
    const sections = [{ roles: ['r-attendant'] }, { roles: [] }, {}];
    expect(scopeOptionsUsedBySections(sections, 'roles', ROLES)).toEqual([
      { _id: 'r-attendant', name: 'Attendant' },
    ]);
  });

  it('is empty for a wholly company-wide form', () => {
    expect(
      scopeOptionsUsedBySections(
        [{ departments: [] }, {}],
        'departments',
        DEPARTMENTS
      )
    ).toEqual([]);
    expect(
      scopeOptionsUsedBySections([{ roles: [] }, {}], 'roles', ROLES)
    ).toEqual([]);
  });
});
