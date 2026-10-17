import { PiMapPin } from 'react-icons/pi';
import { formatSellerDistance } from './seller-proximity';
export default function SellerProximity({ distanceKm, nearest = false }: {
  distanceKm: number | null | undefined; nearest?: boolean;
}) {
  const known = typeof distanceKm === 'number' && Number.isFinite(distanceKm) && distanceKm >= 0;
  return <span title="Approximate geographic distance to the seller’s business address" className="inline-flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-zinc-500">
    <span className="inline-flex items-center gap-1 tabular-nums"><PiMapPin size={12} aria-hidden />{formatSellerDistance(distanceKm)}</span>
    {nearest && known && <span className="rounded-full bg-green-50 px-2 font-semibold text-[#166534]">Closest available</span>}
  </span>;
}
