export type AdjustmentMode = 'count' | 'add' | 'remove';
export function adjustmentTarget(
  mode: AdjustmentMode,
  value: string,
  current: number,
  reserved: number,
) {
  const amount = Number(value);
  const target = mode === 'count' ? amount : mode === 'add' ? current + amount : current - amount;
  const delta = target - current;
  let error = '';
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(reserved) || reserved < 0)
    error = 'Current stock is invalid. Refresh counts before adjusting';
  else if (
    !value.trim() ||
    !Number.isSafeInteger(amount) ||
    amount < 0 ||
    (mode !== 'count' && amount === 0)
  )
    error = 'Enter a whole quantity';
  else if (!Number.isSafeInteger(target) || target < 0)
    error = 'The resulting count cannot be negative';
  else if (target < reserved) error = 'The count cannot be lower than reserved stock';
  else if (!Number.isSafeInteger(delta)) error = 'The adjustment quantity is too large';
  else if (delta === 0) error = 'That is already the current count';
  return { target, delta, error };
}
export const matchAdjustmentProduct = (label: string, search: string) => {
  const normal = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  const terms = normal(search)
    .split(/[,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const text = normal(label);
  return (
    !terms.length || terms.some((term) => term.split(/\s+/).every((word) => text.includes(word)))
  );
};
