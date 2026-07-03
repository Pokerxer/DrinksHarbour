'use client';
import React from 'react';
import { STATUS_CONFIG } from '../_constants';

interface StatusBadgeProps {
  status: string;
  icon?: boolean;
}

export default function StatusBadge({ status, icon }: StatusBadgeProps) {
  const key = status?.toLowerCase();
  const config = STATUS_CONFIG[key] || STATUS_CONFIG.pending;
  const { color, bg, border, icon: Icon } = config;

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-md ${bg} ${border} ${color}`}>
      {icon && <Icon size={11} />}
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}
