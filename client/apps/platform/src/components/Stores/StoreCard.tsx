import Link from 'next/link';
import Image from '@/components/UI/OptimizedImage';
import * as Icon from 'react-icons/pi';
import type { Store } from './directory.types';

const PLAN_BADGES: Record<string, { label: string; cls: string }> = {
  enterprise: { label: 'Enterprise', cls: 'bg-purple-100 text-purple-700' },
  pro:        { label: 'Pro',        cls: 'bg-blue-100 text-blue-700' },
  starter:    { label: 'Starter',    cls: 'bg-green-100 text-green-700' },
  free_trial: { label: 'Trial',      cls: 'bg-gray-100 text-gray-500' },
  custom:     { label: 'Custom',     cls: 'bg-amber-100 text-amber-700' },
};

function nameToGradient(name: string): string {
  const gradients = [
    'from-red-700 to-red-900',
    'from-purple-600 to-purple-900',
    'from-blue-600 to-blue-900',
    'from-emerald-600 to-emerald-900',
    'from-amber-600 to-amber-800',
    'from-rose-600 to-rose-900',
    'from-indigo-600 to-indigo-900',
    'from-teal-600 to-teal-900',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return gradients[Math.abs(hash) % gradients.length];
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// ─── Store Card ───────────────────────────────────────────────────────────────

export default function StoreCard({ store, featured = false }: { store: Store; featured?: boolean }) {
  const badge = PLAN_BADGES[store.plan ?? ''];
  const gradient = nameToGradient(store.name);
  const location = [store.city, store.state].filter(Boolean).join(', ');

  return (
    <Link
      href={`/vendors/${store.slug}`}
      className={`group bg-white rounded-2xl border shadow-sm hover:shadow-lg hover:border-red-100 transition-all duration-200 overflow-hidden flex flex-col ${
        featured ? 'border-red-100 ring-1 ring-red-100' : 'border-gray-100'
      }`}
    >
      {/* Banner / avatar area */}
      <div className={`relative ${featured ? 'h-36' : 'h-28'} bg-gradient-to-br ${gradient} flex items-center justify-center overflow-hidden`}>
        {store.logo?.url ? (
          <Image
            src={store.logo.url}
            alt={store.logo.alt ?? store.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 100vw, 33vw"
          />
        ) : (
          <span className={`${featured ? 'text-4xl' : 'text-3xl'} font-black text-white/90 select-none`}>
            {initials(store.name)}
          </span>
        )}
        {badge && (
          <span className={`absolute top-3 right-3 text-[10px] font-semibold px-2 py-0.5 rounded-full ${badge.cls}`}>
            {badge.label}
          </span>
        )}
        {featured && (
          <span className="absolute top-3 left-3 flex items-center gap-1 text-[10px] font-bold bg-amber-400 text-amber-900 px-2 py-0.5 rounded-full">
            <Icon.PiStarFill size={10} /> Top Vendor
          </span>
        )}
        {/* Product count chip */}
        {(store.productCount ?? 0) > 0 && (
          <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
            <Icon.PiPackage size={10} />
            {store.productCount}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4 flex flex-col flex-1">
        <h3 className={`font-bold text-gray-900 group-hover:text-red-700 transition-colors leading-snug mb-1 ${featured ? 'text-base' : 'text-sm'}`}>
          {store.name}
        </h3>

        {location && (
          <p className="flex items-center gap-1 text-xs text-gray-400 mb-2">
            <Icon.PiMapPin size={12} />
            {location}
          </p>
        )}

        {store.description && (
          <p className="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
            {store.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2 border-t border-gray-50">
          <span className="text-xs text-gray-400">
            {store.productCount
              ? `${store.productCount.toLocaleString()} product${store.productCount !== 1 ? 's' : ''}`
              : 'New store'}
          </span>
          <span className="flex items-center gap-1 text-xs text-red-700 font-semibold group-hover:gap-2 transition-all">
            Visit <Icon.PiArrowRight size={13} />
          </span>
        </div>
      </div>
    </Link>
  );
}

