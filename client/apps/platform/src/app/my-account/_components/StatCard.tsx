'use client';
import React from 'react';
import type { ElementType } from 'react';

interface StatCardProps {
  icon: ElementType;
  label: string;
  value: string | number;
  color: string;
  loading?: boolean;
}

export default function StatCard({ icon: Icon, label, value, color, loading }: StatCardProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4">
        <div className="w-9 h-9 rounded-xl bg-stone-100 animate-pulse mb-3" />
        <div className="h-7 w-16 bg-stone-100 animate-pulse rounded mb-1" />
        <div className="h-4 w-20 bg-stone-100 animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-4 hover:shadow-md transition-all duration-200">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${color}`}>
        <Icon size={18} />
      </div>
      <p className="text-xl font-black text-stone-900">{value}</p>
      <p className="text-xs text-stone-500 mt-0.5">{label}</p>
    </div>
  );
}
