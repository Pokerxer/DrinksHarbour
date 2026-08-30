// @ts-nocheck
'use client';

/**
 * Mobile card list for the banners table.
 * The TanStack table is hidden below `md`; without these cards mobile users
 * saw an empty container. Cards expose the same actions as the desktop rows.
 */

import Link from 'next/link';
import { ActionIcon, Text } from 'rizzui';
import {
  PiPencilLineBold,
  PiEyeBold,
  PiCopyBold,
  PiTrashBold,
  PiPlayBold,
  PiPauseBold,
  PiImageBold,
} from 'react-icons/pi';
import { motion } from 'framer-motion';
import { routes } from '@/config/routes';
import {
  StatusBadge,
  PriorityBadge,
  TypeBadge,
  PlacementLabel,
} from '../banner-shared';
import type { BannerListItem } from './columns';

interface MobileCardsProps {
  banners: BannerListItem[];
  onStatusChange: (id: string, status: string) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function BannerMobileCards({
  banners,
  onStatusChange,
  onClone,
  onDelete,
}: MobileCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {banners.map((banner, idx) => {
        const id = banner._id;
        if (!id) return null;
        const isActive = banner.status === 'active';
        const isPaused = banner.status === 'paused';

        return (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(idx * 0.04, 0.4) }}
            className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                {banner.image?.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner.image.url}
                    alt={banner.title || 'Banner'}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <PiImageBold className="h-5 w-5 text-gray-300" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <Text className="block truncate font-semibold text-gray-900">
                  {banner.title || 'Untitled'}
                </Text>
                {banner.subtitle && (
                  <Text className="mt-0.5 block truncate text-xs text-gray-500">
                    {banner.subtitle}
                  </Text>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={banner.status} size="sm" />
                  <TypeBadge type={banner.type} />
                  <PriorityBadge priority={banner.priority} size="sm" />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
              <PlacementLabel placement={banner.placement} />
              <div className="flex items-center gap-3 text-xs tabular-nums text-gray-500">
                <span>{(banner.impressions ?? 0).toLocaleString()} imp</span>
                <span>{(banner.clicks ?? 0).toLocaleString()} clk</span>
                <span>{(banner.clickThroughRate ?? 0).toFixed(1)}% CTR</span>
              </div>
              <div className="flex items-center gap-1">
                {(isActive || isPaused) && (
                  <ActionIcon
                    variant="outline"
                    size="sm"
                    aria-label={isActive ? 'Pause banner' : 'Activate banner'}
                    onClick={() =>
                      onStatusChange(id, isActive ? 'paused' : 'active')
                    }
                  >
                    {isActive ? (
                      <PiPauseBold className="h-4 w-4" />
                    ) : (
                      <PiPlayBold className="h-4 w-4" />
                    )}
                  </ActionIcon>
                )}
                <Link href={routes.eCommerce.bannerDetails(id)}>
                  <ActionIcon variant="outline" size="sm" aria-label="View banner">
                    <PiEyeBold className="h-4 w-4" />
                  </ActionIcon>
                </Link>
                <Link href={routes.eCommerce.editBanner(id)}>
                  <ActionIcon variant="outline" size="sm" aria-label="Edit banner">
                    <PiPencilLineBold className="h-4 w-4" />
                  </ActionIcon>
                </Link>
                <ActionIcon
                  variant="outline"
                  size="sm"
                  aria-label="Clone banner"
                  onClick={() => onClone(id)}
                >
                  <PiCopyBold className="h-4 w-4" />
                </ActionIcon>
                <ActionIcon
                  variant="outline"
                  size="sm"
                  aria-label="Delete banner"
                  onClick={() => onDelete(id)}
                  className="hover:!text-red-600 hover:!border-red-400"
                >
                  <PiTrashBold className="h-4 w-4" />
                </ActionIcon>
              </div>
            </div>
          </motion.div>
        );
      })}

      {banners.length > 0 && (
        <p className="pt-1 text-center text-xs text-gray-400">
          Showing all loaded banners for this page
        </p>
      )}
    </div>
  );
}
