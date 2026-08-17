// What the orders list sends to the server, and what it writes to a CSV.
//
// Three silent failures live here:
//
//  1. `salesperson` is a String on the schema (the user's name, set from
//     req.user.name) but the client type declared `{ _id, name } | null`. So
//     the column rendered '—' forever, and "My Quotations" sent the user's
//     ObjectId into a field holding names — zero rows, no error.
//  2. The advanced filters were sent as `{ fieldId, operator, value }` while
//     the server keys off `field` (the document path). Every filter was
//     dropped: the chip appeared, the result set never moved.
//  3. "Export all" wrote only the loaded page.
//
// Each degrades to a plausible wrong answer, so these tests assert on the
// params object that reaches the service and the matrix that becomes the file.

import { describe, expect, test } from 'vitest';
import {
  salespersonName,
  buildListParams,
  csvMatrix,
  collectAllPages,
} from './sales-list-helpers';
import type { ActiveFilter, WireFilter } from './sales-list-helpers';
import type { SalesOrder } from '@/services/salesOrder.service';

function order(over: Partial<SalesOrder> = {}): SalesOrder {
  return {
    _id: 'so1',
    soNumber: 'SO2026081600001',
    docType: 'order',
    currency: 'NGN',
    items: [],
    subtotal: 0,
    discountTotal: 0,
    taxTotal: 500,
    total: 40000,
    fulfillments: [],
    createdAt: '2026-08-16T10:00:00.000Z',
    ...over,
  } as SalesOrder;
}

const baseInput = {
  activeFilters: [] as ActiveFilter[],
  search: '',
  groupBy: 'none' as const,
  groupBySubOption: undefined,
  currentUserName: 'Ada Lovelace',
  dateFrom: '',
  dateTo: '',
  page: 1,
};

describe('salespersonName', () => {
  test('a salesperson is a name string, and it is rendered', () => {
    expect(salespersonName(order({ salesperson: 'Ada Lovelace' }))).toBe(
      'Ada Lovelace'
    );
  });

  test('an order with no salesperson reads as None', () => {
    expect(salespersonName(order({ salesperson: undefined }))).toBe('None');
    expect(salespersonName(order({ salesperson: '' }))).toBe('None');
  });
});

describe('buildListParams — the "my" filter', () => {
  test("it filters by the user's name, because that is what the field holds", () => {
    const params = buildListParams({
      ...baseInput,
      activeFilters: [{ id: 'my', label: 'My Quotations', type: 'my' }],
    });

    expect(params.salesperson).toBe('Ada Lovelace');
  });

  test('without the filter no salesperson param is sent at all', () => {
    expect(buildListParams(baseInput).salesperson).toBeUndefined();
  });

  test('an unnamed session does not send an empty salesperson that matches nothing', () => {
    const params = buildListParams({
      ...baseInput,
      currentUserName: '',
      activeFilters: [{ id: 'my', label: 'My Quotations', type: 'my' }],
    });

    expect(params.salesperson).toBeUndefined();
  });
});

describe('buildListParams — advanced filters', () => {
  test('a filter is sent with the document path the server keys off', () => {
    const params = buildListParams({
      ...baseInput,
      activeFilters: [
        {
          id: 'payment_status',
          label: 'Payment Status: partial',
          type: 'custom',
          value: 'partial',
          filterValue: {
            fieldId: 'payment_status',
            field: 'paymentStatus',
            operator: 'equals',
            value: 'partial',
            label: 'Payment Status: partial',
          },
        },
      ],
    });

    const sent = JSON.parse(String(params.filters)) as WireFilter[];
    expect(sent).toHaveLength(1);
    expect(sent[0].field).toBe('paymentStatus');
    expect(sent[0].operator).toBe('equals');
    expect(sent[0].value).toBe('partial');
  });

  test('a favourite saved before the path was carried is resolved from its fieldId', () => {
    // localStorage favourites predate the `field` key; they must not go dead.
    const params = buildListParams({
      ...baseInput,
      activeFilters: [
        {
          id: 'payment_method',
          label: 'Payment Method: cash',
          type: 'custom',
          value: 'cash',
          filterValue: {
            fieldId: 'payment_method',
            operator: 'equals',
            value: 'cash',
            label: 'Payment Method: cash',
          },
        },
      ],
    });

    expect((JSON.parse(String(params.filters)) as WireFilter[])[0].field).toBe(
      'paymentMethod'
    );
  });

  test('a filter that resolves to no document path is not sent', () => {
    const params = buildListParams({
      ...baseInput,
      activeFilters: [
        {
          id: 'nonsense',
          label: 'Nonsense',
          type: 'custom',
          value: 'x',
          filterValue: {
            fieldId: 'nonsense',
            operator: 'equals',
            value: 'x',
            label: 'Nonsense',
          },
        },
      ],
    });

    expect(params.filters).toBeUndefined();
  });

  test('no custom filters means no filters param', () => {
    expect(buildListParams(baseInput).filters).toBeUndefined();
  });
});

describe('buildListParams — paging and grouping', () => {
  test('an ungrouped list is paginated', () => {
    const params = buildListParams({ ...baseInput, page: 3 });

    expect(params.page).toBe(3);
    expect(params.limit).toBeGreaterThan(0);
  });

  test('a grouped list sends no page or limit — grouping counts the whole set', () => {
    const params = buildListParams({ ...baseInput, groupBy: 'salesperson' });

    expect(params.groupBy).toBe('salesperson');
    expect(params.page).toBeUndefined();
    expect(params.limit).toBeUndefined();
  });

  test('an explicit page size overrides the default, for export', () => {
    const params = buildListParams({ ...baseInput, page: 2, pageSize: 100 });

    expect(params.limit).toBe(100);
  });

  test('a custom date range overrides the preset', () => {
    const params = buildListParams({
      ...baseInput,
      activeFilters: [
        { id: 'date-today', label: 'Today', type: 'date', value: 'today' },
      ],
      dateFrom: '2026-01-01',
      dateTo: '2026-01-31',
    });

    // Sent as UTC instants, but they must mark local midnight-to-midnight on
    // the requested days — asserted through a Date so this holds in any zone.
    const from = new Date(String(params.dateFrom));
    const to = new Date(String(params.dateTo));

    expect([from.getFullYear(), from.getMonth(), from.getDate()]).toEqual([
      2026, 0, 1,
    ]);
    expect(from.getHours()).toBe(0);
    expect([to.getFullYear(), to.getMonth(), to.getDate()]).toEqual([
      2026, 0, 31,
    ]);
    expect(to.getHours()).toBe(23);
  });

  test('the docType filter is sent', () => {
    const params = buildListParams({
      ...baseInput,
      activeFilters: [
        { id: 'order', label: 'Sales Orders', type: 'docType', value: 'order' },
      ],
    });

    expect(params.docType).toBe('order');
  });
});

describe('csvMatrix', () => {
  test('the export carries payment state, not just the total', () => {
    const { headers } = csvMatrix([order()]);

    expect(headers).toContain('Payment Status');
    expect(headers).toContain('Amount Paid');
    expect(headers).toContain('Outstanding');
  });

  test('a partially paid order exports what the till took, not the order total', () => {
    const { headers, rows } = csvMatrix([
      order({ total: 40000, paymentStatus: 'partial', amountPaid: 12000 }),
    ]);

    const cell = (name: string) => rows[0][headers.indexOf(name)];
    expect(cell('Payment Status')).toBe('Partial');
    expect(cell('Amount Paid')).toBe(12000);
    expect(cell('Outstanding')).toBe(28000);
  });

  test('a cancelled order does not export as a live one', () => {
    const { headers, rows } = csvMatrix([order({ orderStatus: 'cancelled' })]);

    expect(rows[0][headers.indexOf('Status')]).toBe('Cancelled');
  });

  test('the salesperson name reaches the file', () => {
    const { headers, rows } = csvMatrix([
      order({ salesperson: 'Grace Hopper' }),
    ]);

    expect(rows[0][headers.indexOf('Salesperson')]).toBe('Grace Hopper');
  });

  test('every row has exactly one cell per header', () => {
    const { headers, rows } = csvMatrix([order(), order({ _id: 'so2' })]);

    for (const row of rows) expect(row).toHaveLength(headers.length);
  });
});

describe('collectAllPages', () => {
  test('it keeps fetching until it has the whole result set', async () => {
    const all = Array.from({ length: 250 }, (_, i) => ({ _id: `so${i}` }));
    const seen: number[] = [];

    const result = await collectAllPages(
      async (page) => {
        seen.push(page);
        return {
          rows: all.slice((page - 1) * 100, page * 100),
          total: all.length,
        };
      },
      { pageSize: 100 }
    );

    expect(result.rows).toHaveLength(250);
    expect(result.complete).toBe(true);
    expect(seen).toEqual([1, 2, 3]);
  });

  test('a single page is one request', async () => {
    const seen: number[] = [];
    const result = await collectAllPages(
      async (page) => {
        seen.push(page);
        return { rows: [{ _id: 'so1' }], total: 1 };
      },
      { pageSize: 100 }
    );

    expect(seen).toEqual([1]);
    expect(result.complete).toBe(true);
  });

  test('when it stops short it says so, rather than reporting a partial export as whole', async () => {
    const result = await collectAllPages(
      async (page) => ({
        rows: Array.from({ length: 100 }, (_, i) => ({
          _id: `so${page}-${i}`,
        })),
        total: 100_000,
      }),
      { pageSize: 100, maxPages: 3 }
    );

    expect(result.rows).toHaveLength(300);
    expect(result.complete).toBe(false);
  });

  test('an empty result set is complete, not an infinite loop', async () => {
    const result = await collectAllPages(async () => ({ rows: [], total: 0 }), {
      pageSize: 100,
    });

    expect(result.rows).toEqual([]);
    expect(result.complete).toBe(true);
  });

  test('a page that comes back short of its size ends the walk', async () => {
    // A server-side cap or a concurrent delete must not spin the loop.
    let calls = 0;
    const result = await collectAllPages(
      async () => {
        calls += 1;
        return { rows: [{ _id: 'a' }], total: 500 };
      },
      { pageSize: 100 }
    );

    expect(calls).toBe(1);
    expect(result.complete).toBe(false);
  });
});
