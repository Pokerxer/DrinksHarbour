'use client';

/**
 * Live overview strip for /roles-permissions — four compact tiles computed
 * from data the view has already loaded. Labels are audience-aware: platform
 * admins count their users, tenant owners count their team.
 */

import type { ReactNode } from 'react';
import { Text } from 'rizzui';
import {
  PiProhibitBold,
  PiSealCheckBold,
  PiSquaresFourBold,
  PiUsersThreeBold,
} from 'react-icons/pi';

import cn from '@core/utils/class-names';

export interface RolesStats {
  totalPeople: number;
  activePeople: number;
  suspendedPeople: number;
  customRoles: number;
}

interface Tile {
  label: string;
  value: number;
  icon: ReactNode;
  iconClassName: string;
}

const ICON_BASE =
  'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl';

function StatTile({ label, value, icon, iconClassName }: Tile) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <span className={cn(ICON_BASE, iconClassName)} aria-hidden>
        {icon}
      </span>
      <span className="min-w-0">
        <Text className="block text-xl font-bold leading-none tabular-nums text-gray-900 dark:text-white">
          {value}
        </Text>
        <Text className="mt-1 block truncate text-xs text-gray-500 dark:text-gray-400">
          {label}
        </Text>
      </span>
    </div>
  );
}

export default function RolesStatsStrip({
  stats,
  audience,
}: {
  stats: RolesStats;
  audience: 'platform' | 'tenant';
}) {
  const tiles: Tile[] = [
    {
      label: audience === 'tenant' ? 'Team members' : 'Platform users',
      value: stats.totalPeople,
      icon: <PiUsersThreeBold className="h-5 w-5" />,
      iconClassName: 'bg-primary-lighter text-primary dark:bg-primary-dark',
    },
    {
      label: 'Active',
      value: stats.activePeople,
      icon: <PiSealCheckBold className="h-5 w-5" />,
      iconClassName:
        'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    },
    {
      label: 'Access suspended',
      value: stats.suspendedPeople,
      icon: <PiProhibitBold className="h-5 w-5" />,
      iconClassName: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    },
    {
      label: 'Custom roles',
      value: stats.customRoles,
      icon: <PiSquaresFourBold className="h-5 w-5" />,
      iconClassName:
        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      {tiles.map((tile) => (
        <StatTile key={tile.label} {...tile} />
      ))}
    </div>
  );
}
