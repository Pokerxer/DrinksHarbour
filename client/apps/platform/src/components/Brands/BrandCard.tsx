import Link from 'next/link';
import Image from '@/components/UI/OptimizedImage';
import { PiArrowRightBold } from 'react-icons/pi';
import type { BrandCardData } from '@/app/brands/brand-results';

const gradients = [
  'from-red-700 to-red-900', 'from-purple-600 to-purple-900',
  'from-blue-600 to-blue-900', 'from-emerald-600 to-emerald-900',
  'from-amber-600 to-amber-800', 'from-rose-600 to-rose-900',
  'from-indigo-600 to-indigo-900', 'from-teal-600 to-teal-900',
  'from-orange-600 to-orange-900', 'from-cyan-600 to-cyan-900',
];

function nameToGradient(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

export default function BrandCard({ brand }: { brand: BrandCardData }) {
  const image = brand.logo?.url || brand.logoVariants?.primary || brand.logoVariants?.white || brand.featuredImage?.url;
  const initials = brand.name.trim().split(/\s+/).slice(0, 2).map(word => word[0]).join('').toUpperCase();
  return (
    <Link href={`/brands/${brand.slug}`}
      className="group flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm transition-all hover:-translate-y-1.5 hover:border-stone-300 hover:shadow-xl focus-visible:outline-red-700 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
      <div className={`relative h-28 shrink-0 overflow-hidden bg-gradient-to-br ${nameToGradient(brand.name)}`}>
        {image ? <>
          <Image src={image} alt="" fill sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1279px) 25vw, 20vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105 motion-reduce:transform-none motion-reduce:transition-none" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/30 to-transparent" />
        </> : <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white p-2 font-bold text-gray-900 shadow-xl ring-2 ring-white/20">{initials}</span>
        </div>}
        {brand.productCount != null && <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[10px] font-semibold text-white">
          {brand.productCount.toLocaleString()} {brand.productCount === 1 ? 'product' : 'products'}
        </span>}
      </div>
      <div className="flex flex-1 flex-col p-4 text-left">
        {brand.countryOfOrigin && <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-500">{brand.countryOfOrigin}</p>}
        <h2 className="mt-1 break-words text-lg font-black text-gray-900 group-hover:underline">{brand.name}</h2>
        {brand.shortDescription && <p className="mb-3 mt-1.5 line-clamp-2 text-xs leading-5 text-gray-500">{brand.shortDescription}</p>}
        <div className="mt-auto flex items-center justify-between border-t border-stone-100 pt-3 text-red-800">
          <span className="text-xs font-semibold">Explore brand</span>
          <PiArrowRightBold aria-hidden="true" className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}
