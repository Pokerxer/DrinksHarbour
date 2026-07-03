'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useAuth } from '@/context/AuthContext';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import PasswordForm from '../_components/PasswordForm';
import MfaSection from './MfaSection';

export default function SecurityPage() {
  const { token } = useAccount();
  const { user, loadProfile } = useAuth();

  return (
    <div className="space-y-6">

      <div>
        <h1 className="text-2xl font-black text-stone-900">Security</h1>
        <p className="text-sm text-stone-500 mt-0.5">Manage your password and account security</p>
      </div>

      <PasswordForm
        onSave={async ({ currentPassword, newPassword }) => {
          if (!token) return { success: false, message: 'Not authenticated.' };
          try {
            const res = await fetchWithAuth(`${API_URL}/api/users/change-password`, {
              method: 'POST',
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (res.ok && (data.success !== false)) {
              return { success: true, message: 'Password changed successfully! Please log in again with your new password.' };
            }
            return { success: false, message: data.message || 'Failed to update password.' };
          } catch {
            return { success: false, message: 'Something went wrong. Please try again.' };
          }
        }}
      />

      <MfaSection
        token={token}
        mfaEnabled={!!user?.mfaEnabled}
        onMfaChanged={loadProfile}
      />

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
          <Icon.PiDesktopBold size={15} className="text-red-700" />
          <h2 className="font-bold text-stone-900 text-sm">Active Sessions</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center">
              <Icon.PiCheckCircleBold size={18} />
            </div>
            <div>
              <p className="text-sm font-bold text-stone-900">Current session</p>
              <p className="text-xs text-stone-500 mt-0.5">This device &middot; Active now</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 ml-auto flex-shrink-0" />
          </div>
          <p className="text-xs text-stone-400 mt-3">
            If you notice any suspicious activity, change your password immediately and contact our support team.
          </p>
        </div>
      </div>

    </div>
  );
}
