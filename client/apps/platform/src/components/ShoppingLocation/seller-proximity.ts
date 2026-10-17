export function formatSellerDistance(km: number | null | undefined): string {
  if (typeof km !== 'number' || !Number.isFinite(km) || km < 0) return 'Distance unavailable';
  if (km < .1) return 'Under 100 m away';
  if (km < 1) return Math.round(km * 1000 / 50) * 50 + ' m away';
  return '≈' + km.toFixed(1) + ' km away';
}
