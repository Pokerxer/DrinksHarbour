'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

export const inputCls =
  'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-red-300 focus:ring-2 focus:ring-red-100 focus:outline-none transition-all';

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

export function StepHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div>
      <h2 className="text-xl font-black text-gray-900 mb-1">{title}</h2>
      <p className="text-sm text-gray-500 mb-6">{subtitle}</p>
    </div>
  );
}

export function InfoNote({
  icon: Ic = Icon.PiShieldCheckBold,
  color = 'blue',
  children,
}: {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  color?: 'blue' | 'emerald' | 'amber';
  children: React.ReactNode;
}) {
  const colors = {
    blue: 'bg-blue-50 text-blue-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`flex items-start gap-2.5 rounded-xl px-4 py-3 ${colors[color]}`}>
      <Ic size={18} className="flex-shrink-0 mt-0.5" />
      <p className="text-xs leading-relaxed">{children}</p>
    </div>
  );
}