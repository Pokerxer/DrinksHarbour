// @ts-nocheck
'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { Title } from 'rizzui/typography';
import { Collapse } from 'rizzui/collapse';
import cn from '@core/utils/class-names';
import { PiCaretDownBold } from 'react-icons/pi';
import { menuItems } from '@/layouts/hydrogen/menu-items';
import { tenantMenuItems, isSection, planAllows } from '@/layouts/hydrogen/tenant-menu-items';
import type { TenantMenuEntry } from '@/layouts/hydrogen/tenant-menu-items';
import StatusBadge from '@core/components/get-status-badge';
import { useTenant } from '@/context/TenantContext';
import { useSession } from 'next-auth/react';
import { TENANT_ROLES } from '@/types/authorization';

// ─── Platform Admin Sidebar ────────────────────────────────────────────────────

function PlatformSidebarMenu() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const isPlatformAdmin = ['super_admin', 'admin'].includes(session?.user?.role ?? '');

  return (
    <div className="mt-4 pb-3 3xl:mt-6">
      {menuItems.map((item, index) => {
        // Filter platformOnly dropdown items for non-platform-admins
        const visibleDropdownItems = item?.dropdownItems?.filter(
          (d) => isPlatformAdmin || !(d as any).platformOnly
        );
        const effectiveItem = visibleDropdownItems
          ? { ...item, dropdownItems: visibleDropdownItems }
          : item;

        const isActive = pathname === (effectiveItem?.href as string);
        const pathnameExistInDropdowns: any = visibleDropdownItems?.filter(
          (dropdownItem) => dropdownItem.href === pathname
        );
        const isDropdownOpen = Boolean(pathnameExistInDropdowns?.length);

        return (
          <Fragment key={item.name + '-' + index}>
            {item?.href ? (
              <>
                {effectiveItem?.dropdownItems ? (
                  <Collapse
                    defaultOpen={isDropdownOpen}
                    header={({ open, toggle }) => (
                      <div
                        onClick={toggle}
                        className={cn(
                          'group relative mx-3 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 font-medium lg:my-1 2xl:mx-5 2xl:my-2',
                          isDropdownOpen
                            ? 'before:top-2/5 text-primary before:absolute before:-start-3 before:block before:h-4/5 before:w-1 before:rounded-ee-md before:rounded-se-md before:bg-primary 2xl:before:-start-5'
                            : 'text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:text-gray-700/90 dark:hover:text-gray-700'
                        )}
                      >
                        <span className="flex items-center">
                          {item?.icon && (
                            <span
                              className={cn(
                                'me-2 inline-flex h-5 w-5 items-center justify-center rounded-md [&>svg]:h-[20px] [&>svg]:w-[20px]',
                                isDropdownOpen
                                  ? 'text-primary'
                                  : 'text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-700'
                              )}
                            >
                              {item?.icon}
                            </span>
                          )}
                          {item.name}
                        </span>
                        <PiCaretDownBold
                          strokeWidth={3}
                          className={cn(
                            'h-3.5 w-3.5 -rotate-90 text-gray-500 transition-transform duration-200 rtl:rotate-90',
                            open && 'rotate-0 rtl:rotate-0'
                          )}
                        />
                      </div>
                    )}
                  >
                    {effectiveItem?.dropdownItems?.map((dropdownItem, idx) => {
                      const isChildActive = pathname === (dropdownItem?.href as string);
                      return (
                        <Link
                          href={dropdownItem?.href}
                          key={dropdownItem?.name + idx}
                          className={cn(
                            'mx-3.5 mb-0.5 flex items-center justify-between rounded-md px-3.5 py-2 font-medium capitalize last-of-type:mb-1 lg:last-of-type:mb-2 2xl:mx-5',
                            isChildActive
                              ? 'text-primary'
                              : 'text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900'
                          )}
                        >
                          <div className="flex items-center truncate">
                            <span
                              className={cn(
                                'me-[18px] ms-1 inline-flex h-1 w-1 rounded-full bg-current transition-all duration-200',
                                isChildActive
                                  ? 'bg-primary ring-[1px] ring-primary'
                                  : 'opacity-40'
                              )}
                            />
                            <span className="truncate">{dropdownItem?.name}</span>
                          </div>
                          {dropdownItem?.badge?.length ? (
                            <StatusBadge status={dropdownItem?.badge} />
                          ) : null}
                        </Link>
                      );
                    })}
                  </Collapse>
                ) : (
                  <Link
                    href={item?.href}
                    className={cn(
                      'group relative mx-3 my-0.5 flex items-center justify-between rounded-md px-3 py-2 font-medium capitalize lg:my-1 2xl:mx-5 2xl:my-2',
                      isActive
                        ? 'before:top-2/5 text-primary before:absolute before:-start-3 before:block before:h-4/5 before:w-1 before:rounded-ee-md before:rounded-se-md before:bg-primary 2xl:before:-start-5'
                        : 'text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-700/90'
                    )}
                  >
                    <div className="flex items-center truncate">
                      {item?.icon && (
                        <span
                          className={cn(
                            'me-2 inline-flex size-5 items-center justify-center rounded-md [&>svg]:size-5',
                            isActive
                              ? 'text-primary'
                              : 'text-gray-800 dark:text-gray-500 dark:group-hover:text-gray-700'
                          )}
                        >
                          {item?.icon}
                        </span>
                      )}
                      <span className="truncate">{item.name}</span>
                    </div>
                    {item?.badge?.length ? (
                      <StatusBadge status={item?.badge} />
                    ) : null}
                  </Link>
                )}
              </>
            ) : (
              <Title
                as="h6"
                className={cn(
                  'mb-2 truncate px-6 text-xs font-normal uppercase tracking-widest text-gray-500 2xl:px-8',
                  index !== 0 && 'mt-6 3xl:mt-7'
                )}
              >
                {item.name}
              </Title>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Tenant Sidebar ────────────────────────────────────────────────────────────

function TenantSidebarMenu({ accentColor, plan }: { accentColor: string; plan?: string }) {
  const pathname = usePathname();

  const activeStyle = { color: accentColor };
  const activeBorderStyle = { backgroundColor: accentColor };
  const activeBgStyle = { backgroundColor: `${accentColor}12` };

  // Filter out items the plan doesn't allow, then remove sections with no visible items
  const visibleItems = (() => {
    const allowed = tenantMenuItems.filter((entry) => {
      if (isSection(entry)) return true; // keep sections for now, prune below
      return !entry.requiredPlan || planAllows(plan, entry.requiredPlan);
    });

    // Remove sections that have no items following them before the next section
    const result: TenantMenuEntry[] = [];
    for (let i = 0; i < allowed.length; i++) {
      const entry = allowed[i];
      if (isSection(entry)) {
        // Look ahead: is there at least one non-section item before the next section?
        const rest = allowed.slice(i + 1);
        const nextSectionIdx = rest.findIndex(isSection);
        const chunk = nextSectionIdx === -1 ? rest : rest.slice(0, nextSectionIdx);
        if (chunk.length > 0) result.push(entry);
      } else {
        result.push(entry);
      }
    }
    return result;
  })();

  return (
    <div className="mt-4 pb-3 3xl:mt-6">
      {visibleItems.map((entry, index) => {
        if (isSection(entry)) {
          return (
            <Title
              key={entry.label + index}
              as="h6"
              className={cn(
                'mb-2 truncate px-6 text-xs font-normal uppercase tracking-widest text-gray-500 2xl:px-8',
                index !== 0 && 'mt-6 3xl:mt-7'
              )}
            >
              {entry.label}
            </Title>
          );
        }

        const item = entry;
        const isActive = item.href !== '#' && pathname === item.href;
        const pathnameInDropdowns = item.dropdownItems?.some(
          (d) => pathname === d.href
        );
        const isDropdownOpen = Boolean(pathnameInDropdowns);

        return (
          <Fragment key={item.name + index}>
            {item.dropdownItems ? (
              <Collapse
                defaultOpen={isDropdownOpen}
                header={({ open, toggle }) => (
                  <div
                    onClick={toggle}
                    className={cn(
                      'group relative mx-3 flex cursor-pointer items-center justify-between rounded-md px-3 py-2 font-medium lg:my-1 2xl:mx-5 2xl:my-2',
                      isDropdownOpen
                        ? 'before:top-2/5 before:absolute before:-start-3 before:block before:h-4/5 before:w-1 before:rounded-ee-md before:rounded-se-md 2xl:before:-start-5'
                        : 'text-gray-700 transition-colors duration-200 hover:bg-gray-100 dark:text-gray-700/90 dark:hover:text-gray-700'
                    )}
                    style={isDropdownOpen ? activeStyle : undefined}
                  >
                    {/* Active left border */}
                    {isDropdownOpen && (
                      <span
                        className="before:top-2/5 absolute -start-3 block h-4/5 w-1 rounded-ee-md rounded-se-md 2xl:-start-5"
                        style={activeBorderStyle}
                      />
                    )}
                    <span className="flex items-center">
                      {item.icon && (
                        <span
                          className="me-2 inline-flex h-5 w-5 items-center justify-center rounded-md [&>svg]:h-[20px] [&>svg]:w-[20px]"
                          style={isDropdownOpen ? activeStyle : undefined}
                        >
                          {item.icon}
                        </span>
                      )}
                      {item.name}
                    </span>
                    <PiCaretDownBold
                      strokeWidth={3}
                      className={cn(
                        'h-3.5 w-3.5 -rotate-90 text-gray-500 transition-transform duration-200 rtl:rotate-90',
                        open && 'rotate-0 rtl:rotate-0'
                      )}
                    />
                  </div>
                )}
              >
                {item.dropdownItems.map((dropdownItem, idx) => {
                  const isChildActive = pathname === dropdownItem.href;
                  return (
                    <Link
                      href={dropdownItem.href}
                      key={dropdownItem.name + idx}
                      className={cn(
                        'mx-3.5 mb-0.5 flex items-center justify-between rounded-md px-3.5 py-2 font-medium capitalize last-of-type:mb-1 lg:last-of-type:mb-2 2xl:mx-5',
                        !isChildActive &&
                          'text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900'
                      )}
                      style={isChildActive ? activeStyle : undefined}
                    >
                      <div className="flex items-center truncate">
                        <span
                          className="me-[18px] ms-1 inline-flex h-1 w-1 rounded-full bg-current transition-all duration-200"
                          style={
                            isChildActive
                              ? { ...activeBorderStyle, boxShadow: `0 0 0 1px ${accentColor}` }
                              : { opacity: 0.4 }
                          }
                        />
                        <span className="truncate">{dropdownItem.name}</span>
                      </div>
                      {dropdownItem.badge?.length ? (
                        <StatusBadge status={dropdownItem.badge} />
                      ) : null}
                    </Link>
                  );
                })}
              </Collapse>
            ) : (
              <Link
                href={item.href ?? '#'}
                className={cn(
                  'group relative mx-3 my-0.5 flex items-center justify-between rounded-md px-3 py-2 font-medium capitalize lg:my-1 2xl:mx-5 2xl:my-2',
                  !isActive &&
                    'text-gray-700 transition-colors duration-200 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-700/90'
                )}
                style={isActive ? { ...activeStyle, ...activeBgStyle } : undefined}
              >
                {/* Active left border */}
                {isActive && (
                  <span
                    className="absolute -start-3 block h-4/5 w-1 rounded-ee-md rounded-se-md 2xl:-start-5"
                    style={activeBorderStyle}
                  />
                )}
                <div className="flex items-center truncate">
                  {item.icon && (
                    <span
                      className="me-2 inline-flex size-5 items-center justify-center rounded-md [&>svg]:size-5"
                      style={isActive ? activeStyle : undefined}
                    >
                      {item.icon}
                    </span>
                  )}
                  <span className="truncate">{item.name}</span>
                </div>
                {item.badge?.length ? (
                  <StatusBadge status={item.badge} />
                ) : null}
              </Link>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ─── Entry Point ───────────────────────────────────────────────────────────────

export function SidebarMenu() {
  const { isMainSite, tenant } = useTenant();
  const { data: session } = useSession();
  const role = session?.user?.role ?? '';

  // Tenant-role users always see the tenant sidebar — regardless of whether
  // they're on a subdomain or the main platform URL.
  const isTenantUser = TENANT_ROLES.includes(role as any);

  if (!isMainSite || isTenantUser) {
    const accentColor = tenant?.primaryColor || '#dc2626';
    return <TenantSidebarMenu accentColor={accentColor} plan={tenant?.plan} />;
  }

  return <PlatformSidebarMenu />;
}
