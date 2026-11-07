import type { ReturnDisposition, ReturnRange } from '@/services/local-dispatch.service';
export const CONDITIONS = ['sealed', 'damaged', 'expired', 'unverifiable'];
export const EVIDENCE_KINDS = ['operator_note', 'batch_reference', 'photo'];
export const CONDITION_LABELS: Record<string, string> = {
  sealed: 'Sealed / resellable',
  damaged: 'Damaged',
  expired: 'Expired',
  unverifiable: 'Cannot verify condition',
};
export const TREATMENT_LABELS: Record<string, string> = {
  restock: 'Restock into sellable stock',
  retain_quarantine: 'Keep in quarantine',
  write_off: 'Write off (destroy)',
};
export const rangeKey = (range: ReturnRange) => `${range.start}:${range.quantity}`;
export const rangeLabel = (ranges: ReturnRange[]) =>
  ranges
    .map((range) => `${range.quantity} unit(s) from #${range.start}`)
    .join(', ');
export function eligibleTreatments(detail: ReturnDisposition, line: string) {
  const conditions = detail.inspections
    .filter((item) => item.line === line)
    .map((item) => item.condition);
  if (!conditions.length) return [];
  const all = (predicate: (condition: string) => boolean) =>
    conditions.every(predicate);
  const options = ['retain_quarantine'];
  if (all((condition) => condition === 'sealed')) options.unshift('restock');
  if (all((condition) => condition === 'damaged' || condition === 'expired'))
    options.push('write_off');
  return options;
}
// Ranges recorded on the return that are neither inspected nor decided yet.
export function uninspected(detail: ReturnDisposition, line: string) {
  const original = detail.lines.find((saved) => saved.line === line);
  if (!original) return [];
  const touched = new Set(
    [...detail.inspections, ...detail.decisions]
      .filter((item) => item.line === line)
      .flatMap((item) => item.ranges.map(rangeKey))
  );
  return original.ranges.filter((range) => !touched.has(rangeKey(range)));
}
// Ranges inspected for a line but without a recorded treatment decision yet.
export function awaitingTreatment(detail: ReturnDisposition, line: string) {
  const decided = new Set(
    detail.decisions
      .filter((item) => item.line === line)
      .flatMap((item) => item.ranges.map(rangeKey))
  );
  return detail.inspections
    .filter((item) => item.line === line)
    .flatMap((item) => item.ranges)
    .filter((range) => !decided.has(rangeKey(range)));
}
