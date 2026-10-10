// client/apps/admin/src/components/ui/number-input.tsx
'use client';

import { useEffect, useRef, useState } from 'react';

export interface NumberInputProps {
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
 * Numeric input that keeps the operator's raw keystrokes, so a decimal can
 * actually be typed.
 *
 * The reason this component exists: a controlled `type="number"` whose
 * onChange does `Number(e.target.value)` **cannot accept a decimal at all**,
 * whatever `step` says. Typing `89678.98`:
 *
 *   "89678"  -> Number("89678")  -> state 89678
 *   "."      -> Number("89678.") -> state 89678   <- the dot is gone
 *   "9"      -> "896789"         -> state 896789
 *   "8"      -> "8967898"        -> state 8967898
 *
 * `Number("89678.")` is 89678, so the trailing dot never survives the state
 * update and the field snaps back to a whole number. The operator types
 * `89678.98` and gets `8967898`. Adding `step="0.01"` does not help — the
 * character is discarded before `step` is ever consulted.
 *
 * Holding the text locally fixes it: parseable text commits a number live (so
 * totals stay in sync) while the field keeps showing exactly what was typed.
 * An empty or unparseable field is left alone until blur/Enter, when it
 * normalizes to `fallback` and re-clamps to min/max. Outside value changes (a
 * pricelist recompute, say) re-sync the text only while the field is not
 * focused, so typing is never interrupted.
 *
 * Use this for every number field. Do not hand-roll `value={n}` +
 * `Number(e.target.value)`.
 */
export interface NumberBounds {
  min?: number;
  max?: number;
}

function clamp(v: number, bounds?: NumberBounds): number {
  let out = v;
  if (bounds?.min != null) out = Math.max(bounds.min, out);
  if (bounds?.max != null) out = Math.min(bounds.max, out);
  return out;
}

/** What one keystroke does: the text to keep showing, and the number to
 *  commit. `commit: null` means "display only, decide on blur" — which is
 *  what keeps a trailing `.` alive. */
export function numberInputChange(
  raw: string,
  bounds?: NumberBounds
): { text: string; commit: number | null } {
  if (raw.trim() === '') return { text: raw, commit: null };
  const n = Number(raw);
  if (!Number.isFinite(n)) return { text: raw, commit: null };
  return { text: raw, commit: clamp(n, bounds) };
}

/** What blur/Enter does: collapse to a single committed, clamped value. */
export function numberInputNormalize(
  text: string,
  bounds?: NumberBounds,
  fallback?: number
): { text: string; commit: number } {
  const fb = fallback ?? bounds?.min ?? 0;
  const raw = text.trim() === '' ? fb : Number(text);
  const v = clamp(Number.isFinite(raw) ? raw : fb, bounds);
  return { text: String(v), commit: v };
}

export default function NumberInput({
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
}: NumberInputProps) {
  const [text, setText] = useState(String(value));
  const focusedRef = useRef(false);
  const bounds: NumberBounds = { min, max };

  useEffect(() => {
    if (!focusedRef.current) setText(String(value));
  }, [value]);

  function normalize() {
    const { text: next, commit } = numberInputNormalize(text, bounds, fallback);
    onCommit(commit);
    setText(next);
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
        const { text: next, commit } = numberInputChange(e.target.value, bounds);
        setText(next);
        // null = keep displaying the operator's text, decide on blur. Committing
        // here instead is what used to eat the trailing "." of "89678.".
        if (commit !== null) onCommit(commit);
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
