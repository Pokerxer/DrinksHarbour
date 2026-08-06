'use client';

import cn from '@core/utils/class-names';
import { PiPlusBold, PiSidebarSimple } from 'react-icons/pi';
import { ActionIcon, Button, Title } from 'rizzui';
import AccountSwitcher from './account-switcher';

interface InboxToolbarProps {
  title: string;
  railCollapsed: boolean;
  onToggleRail: () => void;
  onCompose: () => void;
  className?: string;
}

/**
 * The page toolbar: a rail collapse toggle and the current folder name on the
 * left, and the single primary action (Compose) on the right.
 */
export default function InboxToolbar({
  title,
  railCollapsed,
  onToggleRail,
  onCompose,
  className,
}: InboxToolbarProps) {
  return (
    <div
      className={cn(
        'mb-4 flex items-center justify-between gap-3 lg:mb-5',
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <ActionIcon
          variant="outline"
          size="sm"
          rounded="full"
          onClick={onToggleRail}
          aria-label={railCollapsed ? 'Show folders' : 'Hide folders'}
          title={railCollapsed ? 'Show folders' : 'Hide folders'}
          className="hidden @4xl:inline-flex"
        >
          <PiSidebarSimple className="h-4 w-4" />
        </ActionIcon>
        <Title
          as="h3"
          className="truncate text-base font-semibold text-gray-900"
        >
          {title}
        </Title>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        <AccountSwitcher />
        <Button size="sm" onClick={onCompose}>
          <PiPlusBold className="me-1.5 h-4 w-4" />
          Compose
        </Button>
      </div>
    </div>
  );
}
