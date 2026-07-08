'use client';

import React, { useRef, useState } from 'react';
import * as Icon from 'react-icons/pi';

export const inputCls =
  'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none transition-colors';

export function Section({
  title,
  icon: Ic,
  subtitle,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="w-8 h-8 rounded-lg bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
          <Ic size={16} />
        </span>
        <div>
          <h3 className="font-bold text-gray-900 text-sm">{title}</h3>
          {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      <div className="space-y-3 pl-10 sm:pl-[42px]">{children}</div>
    </div>
  );
}

export function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
        {hint && !error && <span className="text-[11px] text-gray-400">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="mt-1 text-xs text-red-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} /> {error}
        </p>
      )}
    </label>
  );
}

export function FileInput({ accept, onChange }: { accept: string; onChange: (file: File | null) => void }) {
  const [fileName, setFileName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-dashed border-gray-200 hover:border-red-300 transition-colors text-left"
      >
        <Icon.PiUploadSimpleBold size={20} className="text-gray-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-gray-500 truncate">
          {fileName || 'Click to upload file'}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0] || null;
          setFileName(file?.name || '');
          onChange(file);
        }}
      />
    </>
  );
}

export function Checkbox({
  checked,
  onChange,
  error,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string;
  label: React.ReactNode;
}) {
  return (
    <div>
      <label className="flex items-start gap-3 cursor-pointer">
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all ${
            checked ? 'bg-red-600 border-red-600 text-white' : 'border-gray-300 hover:border-red-300'
          }`}
        >
          {checked && <Icon.PiCheckBold size={12} />}
        </button>
        <span className="text-xs text-gray-600 leading-relaxed">{label}</span>
      </label>
      {error && (
        <p className="mt-1 ml-8 text-xs text-red-600 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} /> {error}
        </p>
      )}
    </div>
  );
}