import type { InsightLine } from '@/services/notificationInsights.service';
import {
  matchesSearch,
  matchesStatus,
  salesUnits,
  movementUnits,
  type InsightStatus,
} from '../insights/list-rules';
import { validQuantity, type Selections } from '../vendor-orders/order-draft';
export type RestockStatus =
  | InsightStatus
  | 'ready'
  | 'manual'
  | 'transfer'
  | 'covered'
  | 'excluded';
export type RestockSort =
  | 'priority'
  | 'sales'
  | 'movement'
  | 'stock'
  | 'quantity'
  | 'name';
export interface RestockRow extends InsightLine {
  quantityEdited?: boolean;
}
export function restockRows(
  lines: InsightLine[],
  choices: Selections
): RestockRow[] {
  return lines.map((line) => {
    const choice = choices[line.key];
    const offer = choice
      ? line.alternatives?.find((o) => o.offerId === choice.offerId)
      : line.selected;
    const selected = offer
      ? { ...offer, quantity: choice?.quantity ?? offer.quantity }
      : null;
    return {
      ...line,
      selected,
      quantityEdited: !!choice,
      ...(offer && !offer.needsManualReview
        ? {
            urgency:
              typeof line.available === 'number' && line.available <= 0
                ? 'urgent'
                : offer.urgency,
            daysOfCover: offer.daysOfCover,
          }
        : {}),
    };
  });
}
export function matchesRestockStatus(line: RestockRow, status: RestockStatus) {
  const o = line.selected;
  const valid = !!o && validQuantity(o.quantity, o);
  const earlierSupply =
    !!o &&
    o.quantity === 0 &&
    (o.replenishment?.shortfallBeforeDelivery ?? 0) > 0;
  if (status === 'ready')
    return !!line.warehouseId && !line.summary && valid && o!.quantity > 0;
  if (status === 'manual')
    return (
      (!!o && (!!o.needsManualReview || !valid || earlierSupply)) ||
      (!o && !!line.alternatives?.length)
    );
  if (status === 'transfer')
    return (
      !!line.transferPlan &&
      ['transfer_review', 'follow_up', 'approval_review'].includes(
        line.transferPlan.nextStep
      )
    );
  if (status === 'covered')
    return (
      !!o &&
      !line.quantityEdited &&
      !o.needsManualReview &&
      !earlierSupply &&
      o.quantity === 0
    );
  if (status === 'excluded')
    return !!o && !!line.quantityEdited && o.quantity === 0;
  return matchesStatus(line, status);
}
export function selectRestockLines(
  lines: RestockRow[],
  query: string,
  status: RestockStatus,
  sort: RestockSort
) {
  const known = (v: unknown): v is number =>
    typeof v === 'number' && Number.isFinite(v);
  const rank = (l: RestockRow) =>
    ({ urgent: 0, high: 1, normal: 2, monitor: 3, unknown: 4 })[
      l.urgency || 'unknown'
    ] ?? 4;
  const metric = (l: RestockRow) =>
    sort === 'stock'
      ? l.available
      : sort === 'quantity'
        ? l.selected?.quantity
        : sort === 'movement'
          ? movementUnits(l)
          : salesUnits(l);
  return lines
    .filter((l) => matchesSearch(l, query) && matchesRestockStatus(l, status))
    .sort((a, b) => {
      let difference = 0;
      if (sort === 'priority') {
        difference = rank(a) - rank(b);
        if (!difference && a.daysOfCover !== b.daysOfCover) {
          const x = known(a.daysOfCover) ? a.daysOfCover : Infinity;
          const y = known(b.daysOfCover) ? b.daysOfCover : Infinity;
          difference = x === y ? 0 : x - y;
        }
        if (!difference)
          difference = (movementUnits(b) ?? -1) - (movementUnits(a) ?? -1);
      } else if (sort !== 'name') {
        const x = metric(a),
          y = metric(b);
        if (known(x) !== known(y)) return known(x) ? -1 : 1;
        if (known(x) && known(y))
          difference = (x - y) * (sort === 'stock' ? 1 : -1);
      }
      return (
        difference ||
        a.productName.localeCompare(b.productName) ||
        a.key.localeCompare(b.key)
      );
    });
}
