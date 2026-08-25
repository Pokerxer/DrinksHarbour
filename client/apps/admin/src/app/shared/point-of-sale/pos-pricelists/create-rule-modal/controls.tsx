'use client';

import React from 'react';
import { PiWarning } from 'react-icons/pi';

export const PCT_PRESETS = [5, 10, 15, 20, 25, 30, 50];

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export function RuleField({ label, error, hint, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold text-gray-600">
        {label}
      </label>
      {children}
      {hint && !error && <p className="mt-1 text-[11px] text-gray-400">{hint}</p>}
      {error && (
        <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-red-500">
          <PiWarning className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

interface RuleInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix' | 'suffix'> {
  hasError?: boolean;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

export function RuleInput({
  hasError,
  prefix,
  suffix,
  className: _cls,
  ...props
}: RuleInputProps) {
  return (
    <div
      className={`flex h-9 items-center overflow-hidden rounded-lg border bg-white transition-colors focus-within:ring-1 ${
        hasError
          ? 'border-red-400 focus-within:border-red-400 focus-within:ring-red-200'
          : 'border-gray-200 focus-within:border-[#b20202] focus-within:ring-[#b20202]/10'
      }`}
    >
      {prefix && (
        <span className="shrink-0 pl-3 text-sm text-gray-400">{prefix}</span>
      )}
      <input
        {...props}
        className="h-full flex-1 bg-transparent px-3 text-sm tabular-nums outline-none"
      />
      {suffix && (
        <span className="shrink-0 pr-3 text-sm text-gray-400">{suffix}</span>
      )}
    </div>
  );
}

export function Seg({
  options,
  value,
  onChange,
  activeColor,
}: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
  activeColor: string;
}) {
  return (
    <div className="flex rounded-lg border border-gray-200 bg-gray-100 p-0.5 text-xs font-semibold">
      {options.map(([v, l]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={`flex-1 rounded-md px-3 py-1.5 transition-all ${
            value === v ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
          style={value === v ? { backgroundColor: activeColor } : {}}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

export function PctChips({
  value,
  onChange,
  activeColor,
}: {
  value: string;
  onChange: (v: string) => void;
  activeColor: string;
}) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {PCT_PRESETS.map((v) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === String(v)}
          onClick={() => onChange(value === String(v) ? '' : String(v))}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold transition-all ${
            value === String(v)
              ? 'border-transparent text-white'
              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
          }`}
          style={value === String(v) ? { backgroundColor: activeColor } : {}}
        >
          {v}%
        </button>
      ))}
    </div>
  );
}
