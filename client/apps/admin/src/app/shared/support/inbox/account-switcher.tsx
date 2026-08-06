'use client';

import cn from '@core/utils/class-names';
import { useAtom } from 'jotai';
import { useState } from 'react';
import {
  PiCaretDownBold,
  PiCheckBold,
  PiGearSixDuotone,
  PiPlusBold,
} from 'react-icons/pi';
import { Button, Dropdown, Text } from 'rizzui';
import ManageAccountsDrawer from './manage-accounts-drawer';
import {
  accountIdAtom,
  checkedUidsAtom,
  folderAtom,
  mailRefreshAtom,
  pageAtom,
  selectedUidAtom,
} from './mail-state';
import SenderAvatar from './sender-avatar';
import { useMailAccounts } from './use-mail';

/**
 * The mailbox switcher: shows which account the inbox is reading and switches
 * between them. Lives in the toolbar rather than the folder rail so it stays
 * reachable when the rail is collapsed, and it is rendered even with a single
 * account — it doubles as the entry point for adding more.
 */
export default function AccountSwitcher({ className }: { className?: string }) {
  const [accountId, setAccountId] = useAtom(accountIdAtom);
  const [refresh] = useAtom(mailRefreshAtom);
  const [, setFolder] = useAtom(folderAtom);
  const [, setPage] = useAtom(pageAtom);
  const [, setSelectedUid] = useAtom(selectedUidAtom);
  const [, setChecked] = useAtom(checkedUidsAtom);
  const [manageOpen, setManageOpen] = useState(false);

  const accounts = useMailAccounts(refresh);
  const list = accounts.data || [];
  const active = list.find((a) => a.id === accountId) ?? list[0] ?? null;

  function switchTo(id: string) {
    if (id === accountId) return;
    setAccountId(id);
    // The new mailbox has its own folder tree; INBOX is the only path
    // guaranteed to exist on both sides of the switch. Selection, checks and
    // paging all referred to the old mailbox, so they reset with it.
    setFolder('INBOX');
    setPage(1);
    setSelectedUid(null);
    setChecked([]);
  }

  // The rail owns rendering the account-list *error*; a broken switcher
  // button next to it would just say the same thing twice.
  if (accounts.error) return null;

  if (!active) {
    // Loaded and genuinely empty: the switcher becomes the "add one" entry.
    if (accounts.loading) return null;
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          className={className}
          onClick={() => setManageOpen(true)}
        >
          <PiPlusBold className="me-1.5 h-3.5 w-3.5" /> Add mailbox
        </Button>
        <ManageAccountsDrawer
          open={manageOpen}
          onClose={() => setManageOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <Dropdown placement="bottom-end" className={className}>
        <Dropdown.Trigger>
          {/* Dropdown.Trigger already renders a <button>; nesting another
              <button> here triggers a hydration error. This element is the
              visual trigger only — interaction lives on the outer button. */}
          <span className="flex cursor-pointer items-center gap-2 rounded-lg border border-muted bg-gray-0 py-1.5 pe-2.5 ps-1.5 text-sm transition-colors duration-200 hover:bg-gray-50">
            <SenderAvatar
              name={active.displayName}
              address={active.address}
              className="!h-6 !w-6 shrink-0 text-[10px]"
            />
            <span className="hidden max-w-[11rem] truncate text-gray-700 sm:inline">
              {active.address}
            </span>
            <PiCaretDownBold className="h-3 w-3 shrink-0 text-gray-500" />
          </span>
        </Dropdown.Trigger>
        <Dropdown.Menu className="w-64 divide-y divide-muted">
          <div className="pb-1">
            {list.map((a) => {
              const isActive = a.id === active.id;
              return (
                <Dropdown.Item
                  key={a.id}
                  className="gap-2.5"
                  onClick={() => switchTo(a.id)}
                >
                  <SenderAvatar
                    name={a.displayName}
                    address={a.address}
                    className="!h-7 !w-7 shrink-0 text-[10px]"
                  />
                  <span className="min-w-0 flex-1">
                    <Text
                      className={cn(
                        'truncate text-sm',
                        isActive
                          ? 'font-semibold text-gray-900'
                          : 'text-gray-700'
                      )}
                    >
                      {a.displayName}
                    </Text>
                    <Text className="truncate text-xs text-gray-500">
                      {a.address}
                    </Text>
                  </span>
                  {isActive && (
                    <PiCheckBold className="h-3.5 w-3.5 shrink-0 text-primary" />
                  )}
                </Dropdown.Item>
              );
            })}
          </div>
          <div className="pt-1">
            <Dropdown.Item
              className="gap-2.5 text-gray-600"
              onClick={() => setManageOpen(true)}
            >
              <span className="flex h-7 w-7 items-center justify-center">
                <PiGearSixDuotone className="h-4 w-4" />
              </span>
              Manage accounts
            </Dropdown.Item>
          </div>
        </Dropdown.Menu>
      </Dropdown>

      <ManageAccountsDrawer
        open={manageOpen}
        onClose={() => setManageOpen(false)}
      />
    </>
  );
}
