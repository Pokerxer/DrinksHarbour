import { Title } from 'rizzui';
import cn from '@core/utils/class-names';

interface MailPanelProps {
  title?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

/**
 * Shared panel chrome for the inbox panes so the folder rail, message list and
 * reading pane all read as one consistent surface (mirrors WidgetCard, but with
 * an internal header slot that never scrolls away with the content).
 */
export default function MailPanel({
  title,
  action,
  className,
  headerClassName,
  bodyClassName,
  children,
}: MailPanelProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-muted bg-gray-0 dark:bg-gray-50',
        className
      )}
    >
      {(title || action) && (
        <div
          className={cn(
            'flex min-h-[52px] flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 py-2.5',
            headerClassName
          )}
        >
          {title && (
            <Title as="h3" className="min-w-0 text-sm font-semibold text-gray-900">
              {title}
            </Title>
          )}
          {action && (
            <div className="flex shrink-0 items-center gap-2">{action}</div>
          )}
        </div>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </div>
  );
}
