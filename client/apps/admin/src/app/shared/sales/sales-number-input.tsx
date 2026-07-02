// client/apps/admin/src/app/shared/sales/sales-number-input.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export interface SalesNumberInputProps {
  value: number;
  onCommit: (v: number) => void;
  min?: number;
  max?: number;
  step?: number | string;
  /** Committed when the field is left empty on blur (defaults to min ?? 0). */
  fallback?: number;
  className?: string;
  title?: string;
  placeholder?: string;
  disabled?: boolean;
}

/**
 * Numeric input that can be cleared completely while typing. Parseable values
 * commit live (so totals stay in sync); an empty or invalid field is left
 * alone until blur/Enter, when it normalizes to `fallback` and re-clamps to
 * min/max. Outside value changes (e.g. a pricelist recompute) re-sync the
 * text only while the field is not focused, so typing is never interrupted.
 */
export default function SalesNumberInput({
  value,
  onCommit,
  min,
  max,
  step,
  fallback,
  className,
  title,
  placeholder,
  disabled,
}: SalesNumberInputProps) {
  const [text, setText] = useState(String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setText(String(value));
  }, [value]);

  function clamp(v: number) {
    let out = v;
    if (min != null) out = Math.max(min, out);
    if (max != null) out = Math.min(max, out);
    return out;
  }

  function normalize() {
    const fb = fallback ?? min ?? 0;
    const raw = text.trim() === '' ? fb : Number(text);
    const v = clamp(Number.isFinite(raw) ? raw : fb);
    onCommit(v);
    setText(String(v));
  }

  return (
    <input
      type="number"
      value={text}
      min={min}
      max={max}
      step={step}
      title={title}
      placeholder={placeholder}
      disabled={disabled}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') return; // let the operator clear it — commit on blur
        const n = Number(raw);
        if (Number.isFinite(n)) onCommit(clamp(n));
      }}
      onBlur={() => {
        focusedRef.current = false;
        normalize();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      className={className}
    />
  );
}
