// @ts-nocheck
'use client';

/**
 * Red brand hero band for the Banners landing view — same treatment as the
 * POS dashboard hero (gradient, decorative circles, logo chip, eyebrow,
 * date, right-side stat chip + refresh).
 */

import Image from 'next/image';
import { PiArrowsClockwise } from 'react-icons/pi';

export default function BannerHero({
  total,
  active,
  loading = false,
  onRefresh,
}: {
  total?: number;
  active?: number;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div
      className="relative overflow-hidden px-6 py-8 md:px-10 lg:px-14"
      style={{
        background:
          'linear-gradient(135deg, #b20202 0%, #8f0101 60%, #6e0101 100%)',
      }}
    >
      <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -bottom-10 right-40 h-48 w-48 rounded-full bg-white/5" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-2 ring-white/20">
            <Image
              src="/logo-short.svg"
              alt="DrinksHarbour"
              width={38}
              height={38}
              className="rounded-xl"
            />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-red-200">
              DrinksHarbour
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-white">Banners</h1>
            <p className="mt-0.5 text-sm text-red-200">
              Storefront campaigns across every placement
            </p>
          </div>
        </div>

        {/* Right-side chips */}
        <div className="flex items-center gap-3">
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              title="Refresh"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
            >
              <PiArrowsClockwise
                className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              />
            </button>
          )}
          {total != null && (
            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 backdrop-blur-sm">
              <div className="text-center">
                <p className="text-[9px] font-bold uppercase tracking-widest text-red-200">
                  Total
                </p>
                <p className="text-xl font-black tabular-nums text-white">
                  {total}
                </p>
              </div>
              {active != null && (
                <>
                  <span className="h-8 w-px bg-white/20" />
                  <div className="text-center">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-green-200">
                      Active
                    </p>
                    <p className="text-xl font-black tabular-nums text-white">
                      {active}
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
