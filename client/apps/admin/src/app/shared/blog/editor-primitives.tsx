'use client';

// Shared primitives for the blog editor. Kept dependency-light so every
// panel can compose them without prop-drilling styling.

import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Button, Text, ActionIcon, Input } from 'rizzui';
import cn from '@core/utils/class-names';
import {
  PiUploadSimpleBold,
  PiSpinnerGapBold,
  PiXBold,
  PiCaretUpBold,
  PiCaretDownBold,
  PiTrashBold,
} from 'react-icons/pi';
import { uploadService } from '@/services/upload.service';

// ─── Character counter ───────────────────────────────────────────────────────

export function CharCount({
  value,
  max,
  warn,
  showTarget,
}: {
  value: string;
  max: number;
  warn?: number;
  showTarget?: boolean;
}) {
  const threshold = warn ?? Math.round(max * 0.9);
  const len = String(value || '').length;
  const cls =
    len > max
      ? 'text-red-600 font-semibold'
      : len > threshold
        ? 'text-amber-600 font-medium'
        : 'text-gray-400';
  const target = warn ? `${warn}-${max}` : `${max}`;
  return (
    <span className={`text-xs tabular-nums ${cls}`}>
      {len}
      <span className="text-gray-300">/{max}</span>
      {showTarget && len <= threshold ? (
        <span className="ms-1 hidden text-gray-400 sm:inline">
          aim for {target}
        </span>
      ) : null}
    </span>
  );
}

// ─── Section card ────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  description,
  icon: Icon,
  children,
  right,
  className,
  bodyClassName,
}: {
  title: string;
  description?: string;
  icon?: any;
  children: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-gray-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]',
        className,
      )}
    >
      <header className="flex items-start gap-3 border-b border-gray-100 px-5 py-3.5">
        {Icon ? (
          <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500 ring-1 ring-gray-100">
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
        <div className="min-w-0 flex-1">
          <Text className="font-semibold leading-tight text-gray-900">
            {title}
          </Text>
          {description ? (
            <p className="mt-0.5 text-xs text-gray-500">{description}</p>
          ) : null}
        </div>
        {right ? <div className="ms-auto flex-shrink-0">{right}</div> : null}
      </header>
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}

// ─── Field label ─────────────────────────────────────────────────────────────

export function FieldLabel({
  children,
  required,
  hint,
  className,
}: {
  children: React.ReactNode;
  required?: boolean;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn('mb-1.5 flex items-baseline gap-1.5', className)}>
      <label className="text-sm font-medium text-gray-700">{children}</label>
      {required ? (
        <span className="text-red-500" aria-hidden>
          *
        </span>
      ) : null}
      {hint ? (
        <span className="text-xs font-normal text-gray-400">{hint}</span>
      ) : null}
    </div>
  );
}

// ─── Status pill ─────────────────────────────────────────────────────────────

export function StatusPill({ status }: { status?: string }) {
  if (!status) return null;
  const published = status === 'published';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
        published
          ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
          : 'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          published ? 'bg-emerald-500' : 'bg-gray-400',
        )}
      />
      {published ? 'Published' : 'Draft'}
    </span>
  );
}

// ─── Image upload ────────────────────────────────────────────────────────────

export function ImageUploadButton({
  token,
  onUploaded,
  label = 'Upload',
  size = 'sm',
}: {
  token: string;
  onUploaded: (url: string) => void;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = '';
    if (!file) return;
    if (!token) return toast.error('Not authenticated — reload and try again');
    if (!file.type.startsWith('image/'))
      return toast.error('Please choose an image file');
    setBusy(true);
    try {
      const res = await uploadService.uploadImage(file, token, 'blog');
      const url = res?.data?.url;
      if (!url) throw new Error('Upload succeeded but no URL was returned');
      onUploaded(url);
      toast.success('Image uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size={size}
        disabled={busy}
        onClick={() => inputRef.current?.click()}
        className="border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50"
      >
        {busy ? (
          <PiSpinnerGapBold className="me-1.5 h-4 w-4 animate-spin" />
        ) : (
          <PiUploadSimpleBold className="me-1.5 h-4 w-4" />
        )}
        {busy ? 'Uploading…' : label}
      </Button>
    </>
  );
}

// ─── URL input with clear button ─────────────────────────────────────────────

export function UrlInput({
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  className,
  size = 'md',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div className="relative">
      <Input
        size={size}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        prefix={prefix}
        className={cn(value ? 'pe-8' : '', className)}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear"
          aria-label="Clear"
          className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
        >
          <PiXBold className="h-3 w-3" />
        </button>
      ) : null}
      {suffix ? <span className="sr-only">{suffix}</span> : null}
    </div>
  );
}

// ─── Block control row (move up/down/delete) ─────────────────────────────────

export function BlockControls({
  onUp,
  onDown,
  onDelete,
  upDisabled,
  downDisabled,
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <ActionIcon
        size="sm"
        variant="text"
        onClick={onUp}
        title="Move up"
        disabled={upDisabled}
        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
      >
        <PiCaretUpBold className="h-3.5 w-3.5" />
      </ActionIcon>
      <ActionIcon
        size="sm"
        variant="text"
        onClick={onDown}
        title="Move down"
        disabled={downDisabled}
        className="text-gray-400 hover:text-gray-700 disabled:opacity-30"
      >
        <PiCaretDownBold className="h-3.5 w-3.5" />
      </ActionIcon>
      <ActionIcon
        size="sm"
        variant="text"
        color="danger"
        onClick={onDelete}
        title="Remove block"
        className="text-gray-400 hover:text-red-600"
      >
        <PiTrashBold className="h-3.5 w-3.5" />
      </ActionIcon>
    </div>
  );
}

// Kept for backward-compat with any external callers.
export function IconButtonRow({
  onUp,
  onDown,
  onDelete,
  upDisabled,
  downDisabled,
  extra,
}: {
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
  upDisabled?: boolean;
  downDisabled?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {extra}
      <BlockControls
        onUp={onUp}
        onDown={onDown}
        onDelete={onDelete}
        upDisabled={upDisabled}
        downDisabled={downDisabled}
      />
    </div>
  );
}