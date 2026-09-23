'use client';

import { Switch, Text, Title } from 'rizzui';
import cn from '@core/utils/class-names';

export function slugify(str: string) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

/** '' clears an optional number; anything else becomes a Number for zod. */
export const asOptionalNumber = (v: unknown) =>
  v === '' || v === null ? undefined : Number(v);
/** Same, but '' is a meaningful value the server reads as "clear this rate". */
export const asClearableNumber = (v: unknown) => (v === '' || v === null ? '' : Number(v));

// ─── Layout primitives ────────────────────────────────────────────────────────

export function Card({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6">
      <Title
        as="h5"
        className={cn(
          'font-semibold text-gray-800',
          description ? 'mb-1' : 'mb-5'
        )}
      >
        {title}
      </Title>
      {description && (
        <Text className="mb-5 text-sm text-gray-400">{description}</Text>
      )}
      {children}
    </div>
  );
}

export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 @xl:grid-cols-2">{children}</div>
  );
}

// ─── ImagePicker ──────────────────────────────────────────────────────────────

export function VisibilityToggle({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <div className="min-w-0 flex-1 pr-4">
        <Text className="text-sm font-medium text-gray-700">{label}</Text>
        {description && (
          <Text className="text-xs text-gray-400">{description}</Text>
        )}
      </div>
      <Switch
        checked={!!checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </div>
  );
}

// ─── ColorInput ───────────────────────────────────────────────────────────────

export function ColorInput({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  const safe = value || '#1a202c';
  return (
    <div>
      <Text className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </Text>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={safe}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-gray-200 p-0.5"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#1a202c"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm text-gray-800 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          maxLength={7}
        />
      </div>
      {error && <Text className="mt-1 text-xs text-red-500">{error}</Text>}
    </div>
  );
}

// ─── KYC summary (read-only) ──────────────────────────────────────────────────
