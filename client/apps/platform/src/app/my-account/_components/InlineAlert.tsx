'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

type Variant = 'info' | 'success' | 'error' | 'pending';

const STYLES: Record<Variant, string> = {
  info:    'bg-blue-50 border-blue-200 text-blue-700',
  success: 'bg-green-50 border-green-200 text-green-700',
  error:   'bg-red-50 border-red-200 text-red-700',
  pending: 'bg-blue-50 border-blue-200 text-blue-700',
};

export default function InlineAlert({
  variant, spinning = false, children,
}: { variant: Variant; spinning?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl p-4 flex items-center gap-3 border ${STYLES[variant]}`}>
      {spinning
        ? <span className="w-4 h-4 border-2 border-current/30 border-t-current rounded-full animate-spin flex-shrink-0" />
        : <Icon.PiCheckCircleBold size={16} className="flex-shrink-0" />}
      <p className="text-sm font-semibold">{children}</p>
    </div>
  );
}
