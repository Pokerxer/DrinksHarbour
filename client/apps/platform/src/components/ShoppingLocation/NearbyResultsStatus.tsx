'use client';
import { PiMapPin, PiSpinnerGap } from 'react-icons/pi';
import type { ShoppingLocation } from '../../context/shopping-location';
export default function NearbyResultsStatus({ location, loading, sort }: {
  location: ShoppingLocation | null; loading: boolean; sort?: string | null;
}) {
  if (!location) return null;
  const nearest = !sort || sort === 'nearest';
  const labels: Record<string, string> = {
    priceLowToHigh: 'Price: low to high', priceHighToLow: 'Price: high to low',
    newest: 'Newest first', discountHighToLow: 'Biggest discount first',
    popularity: 'Most popular first', bestselling: 'Best selling first', rating: 'Highest rated first',
    alphabetical: 'Name: A to Z', alphabeticalDesc: 'Name: Z to A',
  };
  return <div className="container mx-auto px-4 py-3 flex items-center gap-2.5 text-sm">
    {loading ? <PiSpinnerGap className="text-[#b20202] animate-spin motion-reduce:animate-none shrink-0" size={18} aria-hidden />
      : <PiMapPin className="text-[#b20202] shrink-0" size={18} aria-hidden />}
    <div className="min-w-0" role="status" aria-live="polite">
      <p className="font-medium text-zinc-800">{loading ? 'Updating drinks for your location…' : nearest ? 'Nearest available sellers first' : (labels[sort || ''] || 'Your selected sort is active')}</p>
      <p className="truncate text-xs text-zinc-500">{location.label}{!loading && nearest ? ' · Farther sellers are still available' : ''}</p>
    </div>
  </div>;
}
