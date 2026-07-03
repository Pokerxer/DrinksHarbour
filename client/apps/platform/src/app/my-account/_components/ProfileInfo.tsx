'use client';
import React from 'react';
import * as Icon from 'react-icons/pi';
import type { AuthUser } from '@/context/AuthContext';

interface ProfileInfoProps {
  user: AuthUser;
  onEdit: () => void;
}

export default function ProfileInfo({ user, onEdit }: ProfileInfoProps) {
  const fields = [
    { label: 'First Name', value: user.firstName || '—' },
    { label: 'Last Name', value: user.lastName || '—' },
    { label: 'Email', value: user.email || '—' },
    { label: 'Phone', value: user.phone || user.phoneNumber || '—' },
  ];

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiUserBold size={15} className="text-red-700" /> Profile Information
        </h2>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 text-xs font-semibold text-red-700 hover:underline"
        >
          <Icon.PiPencilSimple size={13} /> Edit
        </button>
      </div>
      <div className="p-6 grid sm:grid-cols-2 gap-4">
        {fields.map(({ label, value }) => (
          <div key={label}>
            <p className="text-xs text-stone-400 font-medium mb-0.5">{label}</p>
            <p className="text-sm font-semibold text-stone-900">{value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
