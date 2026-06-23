'use client';

import { cn } from '@core/utils/class-names';

export interface FormFieldErrorProps {
  error?: string;
  hint?: string;
  className?: string;
  showIcon?: boolean;
}

export function FormFieldError({
  error,
  hint,
  className,
  showIcon = true,
}: FormFieldErrorProps) {
  if (!error && !hint) return null;

  const isError = Boolean(error);

  return (
    <div
      className={cn(
        'flex items-start gap-1.5 text-xs leading-tight',
        isError ? 'text-red-500' : 'text-gray-500',
        className
      )}
    >
      {showIcon && isError && (
        <svg
          className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
      )}
      <span>{error || hint}</span>
    </div>
  );
}

export interface FieldErrorListProps {
  errors: Array<{ field: string; message: string }>;
  className?: string;
  maxItems?: number;
}

export function FieldErrorList({
  errors,
  className,
  maxItems = 5,
}: FieldErrorListProps) {
  if (!errors || errors.length === 0) return null;

  const displayErrors = errors.slice(0, maxItems);
  const remainingCount = errors.length - maxItems;

  return (
    <div
      className={cn(
        'bg-red-50 border border-red-200 rounded-lg p-3 space-y-1.5',
        className
      )}
    >
      <div className="flex items-center gap-2 text-red-700 font-medium text-sm">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>
          {errors.length} validation error{errors.length !== 1 ? 's' : ''}
        </span>
      </div>

      <ul className="space-y-1 text-sm">
        {displayErrors.map((error, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-red-600"
          >
            <span className="text-red-400">•</span>
            <span>
              <span className="font-medium">{error.field}:</span>{' '}
              {error.message}
            </span>
          </li>
        ))}
      </ul>

      {remainingCount > 0 && (
        <p className="text-xs text-red-500 pt-1">
          +{remainingCount} more error{remainingCount !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );
}

export interface SectionErrorsProps {
  sectionName: string;
  errors: Array<{ field: string; message: string }>;
  className?: string;
  collapsible?: boolean;
}

export function SectionErrors({
  sectionName,
  errors,
  className,
  collapsible = false,
}: SectionErrorsProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <div
      className={cn(
        'bg-amber-50 border border-amber-200 rounded-lg p-3',
        className
      )}
    >
      <div className="flex items-center gap-2 text-amber-700 font-medium text-sm mb-2">
        <svg
          className="w-4 h-4 flex-shrink-0"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
            clipRule="evenodd"
          />
        </svg>
        <span>{sectionName} - {errors.length} error{errors.length !== 1 ? 's' : ''}</span>
      </div>

      <ul className="space-y-1 text-sm">
        {errors.map((error, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-amber-600"
          >
            <span className="text-amber-400">•</span>
            <span>
              <span className="font-medium">{error.field}:</span>{' '}
              {error.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export interface InlineFieldErrorProps {
  error?: string;
  className?: string;
}

export function InlineFieldError({
  error,
  className,
}: InlineFieldErrorProps) {
  if (!error) return null;

  return (
    <p className={cn('text-xs text-red-500 mt-1 flex items-center gap-1', className)}>
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      {error}
    </p>
  );
}
