// The orders list's column set.
//
// `OPTIONAL_COLS` declared fourteen toggles; the table consulted `colVisible`
// for six. The other eight ticked a checkbox and rendered nothing — several had
// no SalesOrder field behind them at all. Separately, the table's colspan was a
// hand-maintained arithmetic expression (`2 + (colVisible('creationDate') ? 1 :
// 0) + 1 + ...`) that had to be kept in step with the JSX by eye.
//
// Both are drift between a list of columns and the code that renders them. The
// fix is to have one list, so these tests pin that the offered toggles and the
// rendered columns are the same set.

import { describe, expect, test } from 'vitest';
import {
  LIST_COLUMNS,
  OPTIONAL_COLS,
  visibleColumns,
  visibleColumnCount,
} from './sales-list-columns';

const allKeys = () => LIST_COLUMNS.map((c) => c.key);
const defaults = () => OPTIONAL_COLS.map((c) => ({ ...c }));

describe('the offered toggles and the rendered columns are one set', () => {
  test('every optional toggle names a column the table renders', () => {
    for (const opt of OPTIONAL_COLS) {
      expect(allKeys()).toContain(opt.key);
    }
  });

  test('every optional column in the set is offered as a toggle', () => {
    const optionalKeys = LIST_COLUMNS.filter((c) => c.optional).map(
      (c) => c.key
    );

    expect(OPTIONAL_COLS.map((c) => c.key).sort()).toEqual(optionalKeys.sort());
  });

  test('the columns that had no backing field are gone', () => {
    for (const dead of [
      'salesTeam',
      'tasks',
      'expectedDate',
      'deliveryDate',
      'customerRef',
      'website',
    ]) {
      expect(allKeys()).not.toContain(dead);
    }
  });

  test('column keys are unique', () => {
    expect(new Set(allKeys()).size).toBe(allKeys().length);
  });
});

describe('visibleColumns', () => {
  test('a hidden optional column is not rendered', () => {
    const cols = defaults().map((c) =>
      c.key === 'total' ? { ...c, visible: false } : c
    );

    expect(visibleColumns(cols).map((c) => c.key)).not.toContain('total');
  });

  test('a shown optional column is rendered', () => {
    const cols = defaults().map((c) =>
      c.key === 'total' ? { ...c, visible: true } : c
    );

    expect(visibleColumns(cols).map((c) => c.key)).toContain('total');
  });

  test('a non-optional column cannot be hidden away', () => {
    // The chooser cannot offer these, but a stale localStorage payload could
    // name one; the row would then lose a cell the header still emits.
    const cols = [
      ...defaults(),
      { key: 'status', label: 'Status', visible: false },
    ];

    expect(visibleColumns(cols).map((c) => c.key)).toContain('status');
    expect(visibleColumns(cols).map((c) => c.key)).toContain('soNumber');
  });

  test('order is stable and follows the declared column order', () => {
    const keys = visibleColumns(defaults()).map((c) => c.key);
    const declared = allKeys().filter((k) => keys.includes(k));

    expect(keys).toEqual(declared);
  });

  test('payment is a column, and it is shown by default', () => {
    expect(allKeys()).toContain('payment');
    expect(visibleColumns(defaults()).map((c) => c.key)).toContain('payment');
  });
});

describe('visibleColumnCount', () => {
  test('it is the number of columns rendered — the two cannot disagree', () => {
    const cols = defaults();

    expect(visibleColumnCount(cols)).toBe(visibleColumns(cols).length);
  });

  test('hiding one optional column moves the count by exactly one', () => {
    const shown = defaults().map((c) =>
      c.key === 'warehouse' ? { ...c, visible: true } : c
    );
    const hidden = shown.map((c) =>
      c.key === 'warehouse' ? { ...c, visible: false } : c
    );

    expect(visibleColumnCount(shown) - visibleColumnCount(hidden)).toBe(1);
  });

  test('with every optional column hidden, only the fixed columns remain', () => {
    const none = defaults().map((c) => ({ ...c, visible: false }));
    const fixed = LIST_COLUMNS.filter((c) => !c.optional).length;

    expect(visibleColumnCount(none)).toBe(fixed);
  });
});
