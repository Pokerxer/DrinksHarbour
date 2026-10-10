export function formatCover(days: number | null | undefined) {
  return days === undefined
    ? 'Unknown'
    : days === null
      ? 'Beyond forecast horizon'
      : `${days} ${days === 1 ? 'day' : 'days'}`;
}
export function methodLabel(method?: string) {
  return method === 'trained_forecast'
    ? 'AI forecast'
    : method === 'historical_baseline'
      ? 'Historical baseline'
      : 'Insufficient history';
}
export const units = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value)
    ? new Intl.NumberFormat('en-NG', { maximumFractionDigits: 1 }).format(value)
    : 'Unknown';
export const money = (value: number, currency: string) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(value);
