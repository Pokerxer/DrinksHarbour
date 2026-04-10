'use client';

import { Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import cn from '@core/utils/class-names';
import { PiWarning, PiX, PiCheck } from 'react-icons/pi';

interface ValidationError {
  field: string;
  section: string;
  message: string;
}

interface ValidationSummaryProps {
  errors: ValidationError[];
  className?: string;
  onDismiss?: () => void;
  variant?: 'error' | 'warning';
}

export function ValidationSummary({
  errors,
  className,
  onDismiss,
  variant = 'error',
}: ValidationSummaryProps) {
  if (!errors || errors.length === 0) return null;

  const isError = variant === 'error';
  const baseClasses = isError
    ? 'bg-red-50 border-red-200 text-red-800'
    : 'bg-amber-50 border-amber-200 text-amber-800';

  const iconColorClass = isError ? 'text-red-500' : 'text-amber-500';
  const countColorClass = isError ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700';

  const groupedBySection = errors.reduce((acc, err) => {
    if (!acc[err.section]) {
      acc[err.section] = [];
    }
    acc[err.section].push(err);
    return acc;
  }, {} as Record<string, ValidationError[]>);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className={cn(
          'rounded-lg border p-4 mb-4',
          baseClasses,
          className
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1">
            <PiWarning className={cn('h-5 w-5 mt-0.5 flex-shrink-0', iconColorClass)} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-semibold text-sm">
                  {isError ? 'Validation Error' : 'Warning'}
                </span>
                <span
                  className={cn(
                    'text-xs font-medium px-2 py-0.5 rounded-full',
                    countColorClass
                  )}
                >
                  {errors.length} issue{errors.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div className="space-y-3">
                {Object.entries(groupedBySection).map(([section, sectionErrors]) => (
                  <div key={section}>
                    <div className="text-xs font-medium uppercase tracking-wide opacity-75 mb-1">
                      {section}
                    </div>
                    <ul className="space-y-1 pl-0">
                      {sectionErrors.map((err, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-2 text-sm"
                        >
                          <span className={cn('mt-1', isError ? 'text-red-400' : 'text-amber-400')}>
                            •
                          </span>
                          <div>
                            <span className="font-medium">{err.field}:</span>{' '}
                            <span>{err.message}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {onDismiss && (
            <button
              onClick={onDismiss}
              className={cn(
                'p-1 rounded hover:bg-opacity-50 transition-colors',
                isError ? 'hover:bg-red-100' : 'hover:bg-amber-100'
              )}
            >
              <PiX className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

interface FieldErrorProps {
  error?: string;
  className?: string;
}

export function FieldError({ error, className }: FieldErrorProps) {
  if (!error) return null;

  return (
    <motion.p
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('text-xs text-red-500 mt-1 flex items-center gap-1', className)}
    >
      <PiWarning className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{error}</span>
    </motion.p>
  );
}

interface FieldSuccessProps {
  message?: string;
  className?: string;
}

export function FieldSuccess({ message, className }: FieldSuccessProps) {
  if (!message) return null;

  return (
    <motion.p
      initial={{ opacity: 0, x: -5 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn('text-xs text-green-600 mt-1 flex items-center gap-1', className)}
    >
      <PiCheck className="h-3.5 w-3.5 flex-shrink-0" />
      <span>{message}</span>
    </motion.p>
  );
}

interface InlineErrorProps {
  errors: string[];
  className?: string;
}

export function InlineErrors({ errors, className }: InlineErrorProps) {
  if (!errors || errors.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className={cn('space-y-1', className)}
    >
      {errors.map((error, index) => (
        <FieldError key={index} error={error} />
      ))}
    </motion.div>
  );
}
