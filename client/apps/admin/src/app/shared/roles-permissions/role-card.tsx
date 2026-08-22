'use client';

/**
 * A single role card — the "access badge" unit of the roles grid.
 *
 * SystemRoleCard and CustomRoleCard share one shell: a tinted icon medallion,
 * name + provenance badge, two-line description, and a hairline-divided meta
 * footer. The whole card is a selection target that filters the People table;
 * custom cards additionally carry edit/delete in their footer.
 */

import type { ReactNode } from 'react';
import { Badge, Text } from 'rizzui';
import {
  PiBuildingsBold,
  PiCheckBold,
  PiCrownSimpleBold,
  PiHardHatBold,
  PiShieldCheckBold,
  PiShieldStarBold,
  PiUserBold,
} from 'react-icons/pi';

import cn from '@core/utils/class-names';
import { SYSTEM_ROLE_META, type UserRole } from '@/types/authorization';

/** Medallion icons for the fixed roles — presentation only, kept out of types/authorization.ts. */
const ROLE_ICONS: Record<UserRole, ReactNode> = {
  super_admin: <PiCrownSimpleBold className="h-5 w-5" />,
  admin: <PiShieldStarBold className="h-5 w-5" />,
  tenant_owner: <PiBuildingsBold className="h-5 w-5" />,
  tenant_admin: <PiShieldCheckBold className="h-5 w-5" />,
  tenant_staff: <PiHardHatBold className="h-5 w-5" />,
  customer: <PiUserBold className="h-5 w-5" />,
};

const MEDALLION_BASE =
  'flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl';

interface ShellProps {
  name: string;
  description: string;
  color: string;
  icon?: ReactNode;
  badgeLabel: 'System' | 'Custom';
  selected: boolean;
  onSelect: () => void;
  /** Footer content rendered after the divider — counts, actions. */
  children: ReactNode;
}

function CardShell({
  name,
  description,
  color,
  icon,
  badgeLabel,
  selected,
  onSelect,
  children,
}: ShellProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        'group flex h-full cursor-pointer flex-col rounded-2xl border bg-white p-4 shadow-sm outline-none transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary dark:bg-gray-900',
        selected
          ? 'border-primary ring-2 ring-primary/20 dark:border-primary'
          : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={MEDALLION_BASE}
            style={{
              backgroundColor: `${color}1A`,
              color,
            }}
          >
            {icon ?? <PiShieldCheckBold className="h-5 w-5" />}
          </span>
          <span className="min-w-0">
            <Text className="block truncate font-semibold text-gray-900 dark:text-white">
              {name}
            </Text>
            <Badge
              variant="flat"
              color={badgeLabel === 'System' ? 'secondary' : 'primary'}
              className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide"
            >
              {badgeLabel}
            </Badge>
          </span>
        </div>

        {selected && (
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <PiCheckBold className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Selected</span>
          </span>
        )}
      </div>

      <Text className="mt-3 line-clamp-2 min-h-[2rem] text-xs leading-relaxed text-gray-500 dark:text-gray-400">
        {description}
      </Text>

      <div className="mt-auto pt-3">
        <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
          {children}
        </div>
      </div>
    </div>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return (
    <Text className="truncate text-xs font-medium text-gray-400 dark:text-gray-500">
      {children}
    </Text>
  );
}

function peopleLabel(n: number): string {
  return `${n} ${n === 1 ? 'person' : 'people'}`;
}

// ─── System ───────────────────────────────────────────────────────────────────

interface SystemRoleCardProps {
  baseRole: UserRole;
  permissionCount: number;
  peopleCount: number;
  selected: boolean;
  onSelect: () => void;
}

export function SystemRoleCard({
  baseRole,
  permissionCount,
  peopleCount,
  selected,
  onSelect,
}: SystemRoleCardProps) {
  const meta = SYSTEM_ROLE_META[baseRole];
  return (
    <CardShell
      name={meta.label}
      description={meta.description}
      color={meta.color}
      icon={ROLE_ICONS[baseRole]}
      badgeLabel="System"
      selected={selected}
      onSelect={onSelect}
    >
      <Meta>
        {permissionCount} permissions · {peopleLabel(peopleCount)}
      </Meta>
    </CardShell>
  );
}

// ─── Custom ───────────────────────────────────────────────────────────────────

interface CustomRoleCardProps {
  name: string;
  description?: string;
  color?: string;
  permissionCount: number;
  assignedCount: number;
  selected: boolean;
  onSelect: () => void;
  actions: ReactNode;
}

export function CustomRoleCard({
  name,
  description,
  color,
  permissionCount,
  assignedCount,
  selected,
  onSelect,
  actions,
}: CustomRoleCardProps) {
  return (
    <CardShell
      name={name}
      description={description || `${permissionCount} permissions granted`}
      color={color || '#6b7280'}
      badgeLabel="Custom"
      selected={selected}
      onSelect={onSelect}
    >
      <Meta>
        {permissionCount} permissions ·{' '}
        {assignedCount > 0 ? `${assignedCount} assigned` : 'unassigned'}
      </Meta>
      <span
        className="flex flex-shrink-0 items-center gap-1"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        role="presentation"
      >
        {actions}
      </span>
    </CardShell>
  );
}
