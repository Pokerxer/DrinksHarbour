'use client';

/**
 * Permission matrix — the catalog grouped by area.
 *
 *   mode="readonly"  → chips showing what a role holds (system roles, and the
 *                      preview on custom cards)
 *   mode="editable"  → checkbox grid for authoring a CUSTOM role, with a
 *                      live held-count per group and select/clear-group
 *                      shortcuts. Platform-only keys are disabled with an
 *                      explanation when the role is tenant-scoped.
 */

import { useMemo } from 'react';
import { Badge, Button, Checkbox, Text, Tooltip } from 'rizzui';

import type { Permission } from '@/types/authorization';
import type { GroupedCatalog } from '@/services/roles.service';

interface Props {
  catalog: GroupedCatalog[];
  mode: 'readonly' | 'editable';
  /** Held permissions — rendered for both modes. */
  value?: Permission[];
  onChange?: (next: Permission[]) => void;
  /** Catalog keys the current audience may never hold (tenant scope). */
  platformOnly?: string[];
}

const GROUP_LABELS: Record<string, string> = {
  products: 'Products',
  subproducts: 'Store Listings',
  orders: 'Orders',
  customers: 'Customers',
  categories: 'Categories',
  brands: 'Brands',
  inventory: 'Inventory',
  reports: 'Reports',
  users: 'Users',
  settings: 'Settings',
  billing: 'Billing',
  analytics: 'Analytics',
  appraisals: 'Appraisals',
};

export default function PermissionMatrix({
  catalog,
  mode,
  value = [],
  onChange,
  platformOnly = [],
}: Props) {
  const held = useMemo(() => new Set(value), [value]);
  const locked = useMemo(() => new Set(platformOnly), [platformOnly]);

  function toggle(key: Permission) {
    if (!onChange) return;
    const next = held.has(key)
      ? value.filter((p) => p !== key)
      : [...value, key];
    onChange(next);
  }

  function setGroup(group: GroupedCatalog, grantAll: boolean) {
    if (!onChange) return;
    const grantable = group.permissions
      .map((entry) => entry.key)
      .filter((key) => !locked.has(key));
    const withoutGroup = value.filter(
      (p) => !grantable.includes(p as never)
    );
    onChange(grantAll ? [...withoutGroup, ...grantable] : withoutGroup);
  }

  if (catalog.length === 0) {
    return (
      <Text className="text-sm text-gray-400 dark:text-gray-500">
        The permission catalog could not be loaded.
      </Text>
    );
  }

  return (
    <div className="space-y-6">
      {catalog.map((group) => {
        const grantableKeys = group.permissions.filter(
          (entry) => !locked.has(entry.key)
        ).length;
        const heldCount = group.permissions.filter((entry) =>
          held.has(entry.key)
        ).length;

        return (
          <div key={group.group}>
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <Text className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {GROUP_LABELS[group.group] ?? group.group}
                <Badge
                  variant="flat"
                  color={heldCount > 0 ? 'success' : 'secondary'}
                  className="text-[10px] font-semibold tabular-nums"
                >
                  {heldCount}/{group.permissions.length}
                </Badge>
              </Text>

              {mode === 'editable' && grantableKeys > 0 && (
                <span className="flex flex-shrink-0 items-center gap-1">
                  <Button
                    size="sm"
                    variant="text"
                    onClick={() => setGroup(group, true)}
                    className="h-7 px-2 text-xs font-medium text-primary"
                  >
                    Select all
                  </Button>
                  <Button
                    size="sm"
                    variant="text"
                    onClick={() => setGroup(group, false)}
                    className="h-7 px-2 text-xs font-medium text-gray-500 hover:text-red-600 dark:hover:text-red-400"
                  >
                    Clear
                  </Button>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-gray-100 p-3 sm:grid-cols-2 xl:grid-cols-3 dark:border-gray-800">
              {group.permissions.map((entry) => {
                const isHeld = held.has(entry.key);
                const isLocked = locked.has(entry.key);

                if (mode === 'readonly') {
                  return isHeld ? (
                    <Tooltip
                      key={entry.key}
                      size="sm"
                      content={entry.description}
                      placement="top"
                      color="invert"
                    >
                      <Badge
                        variant="flat"
                        color="success"
                        className="cursor-default text-xs font-medium"
                      >
                        {entry.label}
                      </Badge>
                    </Tooltip>
                  ) : null;
                }

                return (
                  <Tooltip
                    key={entry.key}
                    size="sm"
                    content={
                      isLocked
                        ? `${entry.description} Platform-only — tenant roles cannot hold this.`
                        : entry.description
                    }
                    placement="top"
                    color="invert"
                  >
                    {/* Tooltip needs a non-disabled wrapper to receive hover. */}
                    <span>
                      <Checkbox
                        label={entry.label}
                        checked={isHeld}
                        disabled={isLocked}
                        onChange={() => toggle(entry.key)}
                        className="[&>label>span]:text-sm [&>label]:cursor-pointer"
                        labelClassName="dark:text-gray-200"
                      />
                    </span>
                  </Tooltip>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
