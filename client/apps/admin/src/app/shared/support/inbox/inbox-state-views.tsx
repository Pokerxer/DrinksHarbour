import {
  PiArrowCounterClockwiseLight,
  PiEnvelopeSimpleLight,
  PiWarningCircleLight,
} from 'react-icons/pi';
import { Button, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';

interface InboxEmptyStateProps {
  title?: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Branded empty state. An empty folder and an error must never look alike, and
 * neither may look like a broken pane — this is the "no messages" end of that
 * contract, with an optional action so an empty inbox still offers a way out.
 */
export function InboxEmptyState({
  title = 'Nothing here yet',
  description,
  action,
  className,
}: InboxEmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-16 text-center',
        className
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-100/40">
        <PiEnvelopeSimpleLight className="h-6 w-6 text-gray-400" />
      </div>
      <Title as="h3" className="mt-4 text-sm font-semibold text-gray-900">
        {title}
      </Title>
      {description && (
        <Text className="mt-1 max-w-xs text-sm text-gray-500">
          {description}
        </Text>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

interface InboxErrorStateProps {
  message: string;
  onRetry?: () => void;
  className?: string;
}

/**
 * Branded error state with a recovery path. Distinct from InboxEmptyState on
 * purpose: an unreachable mail server rendering as "no messages" is precisely
 * the failure mode this feature exists to avoid.
 */
export function InboxErrorState({
  message,
  onRetry,
  className,
}: InboxErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-950/30">
        <PiWarningCircleLight className="h-6 w-6 text-red-600 dark:text-red-400" />
      </div>
      <Text className="mt-3 max-w-sm text-sm font-medium text-red-700 dark:text-red-400">
        {message}
      </Text>
      {onRetry && (
        <Button size="sm" variant="outline" className="mt-4" onClick={onRetry}>
          <PiArrowCounterClockwiseLight className="me-1.5 h-4 w-4" />
          Retry
        </Button>
      )}
    </div>
  );
}
