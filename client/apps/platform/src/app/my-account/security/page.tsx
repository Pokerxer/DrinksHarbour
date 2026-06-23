'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { API_URL } from '@/lib/api';

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all pr-11';

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          required
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={inputCls}
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <Icon.PiEyeSlashBold size={16} /> : <Icon.PiEyeBold size={16} />}
        </button>
      </div>
    </div>
  );
}

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: 'At least 8 characters', ok: password.length >= 8 },
    { label: 'Uppercase letter',       ok: /[A-Z]/.test(password) },
    { label: 'Number',                 ok: /\d/.test(password) },
    { label: 'Special character',      ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const score = checks.filter(c => c.ok).length;
  const colors = ['bg-gray-200', 'bg-red-400', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500'];
  const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

  if (!password) return null;
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1.5">
        {[0,1,2,3].map(i => (
          <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i < score ? colors[score] : 'bg-gray-100'}`} />
        ))}
      </div>
      <p className={`text-[11px] font-semibold ${score <= 1 ? 'text-red-500' : score === 2 ? 'text-orange-500' : score === 3 ? 'text-yellow-600' : 'text-green-600'}`}>
        {labels[score]}
      </p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
        {checks.map(c => (
          <span key={c.label} className={`text-[11px] flex items-center gap-1 ${c.ok ? 'text-green-600' : 'text-gray-400'}`}>
            {c.ok ? <Icon.PiCheckBold size={10} /> : <Icon.PiMinusBold size={10} />} {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function SecurityPage() {
  const { token } = useAccount();
  const [form, setForm]       = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving]   = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    if (form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match.' });
      return;
    }
    if (form.newPassword.length < 8) {
      setMessage({ type: 'error', text: 'Password must be at least 8 characters.' });
      return;
    }
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (res.ok && (data.success !== false)) {
        setMessage({ type: 'success', text: 'Password changed successfully!' });
        setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      } else {
        setMessage({ type: 'error', text: data.message || 'Failed to update password.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Something went wrong. Please try again.' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-black text-gray-900">Security</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your password and account security</p>
      </div>

      {/* ── Change password ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Icon.PiLockBold size={15} className="text-red-700" />
          <h2 className="font-black text-gray-900 text-sm">Change Password</h2>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {message && (
              <motion.div
                key={message.type}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className={`flex items-center gap-2 rounded-xl px-4 py-3 mb-5 border text-sm font-medium ${
                  message.type === 'success'
                    ? 'bg-green-50 border-green-200 text-green-700'
                    : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {message.type === 'success'
                  ? <Icon.PiCheckCircleFill size={16} className="text-green-600" />
                  : <Icon.PiWarningCircleBold size={16} className="text-red-600" />}
                {message.text}
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-4">
            <PasswordField
              label="Current Password"
              value={form.currentPassword}
              onChange={v => setForm(f => ({ ...f, currentPassword: v }))}
            />
            <div>
              <PasswordField
                label="New Password"
                value={form.newPassword}
                onChange={v => setForm(f => ({ ...f, newPassword: v }))}
                placeholder="Min. 8 characters"
              />
              <PasswordStrength password={form.newPassword} />
            </div>
            <PasswordField
              label="Confirm New Password"
              value={form.confirmPassword}
              onChange={v => setForm(f => ({ ...f, confirmPassword: v }))}
            />

            <div className="pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60"
              >
                {saving
                  ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
                  : <><Icon.PiFloppyDiskBold size={14} /> Update Password</>}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ── 2FA ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Icon.PiShieldCheckBold size={15} className="text-red-700" />
          <h2 className="font-black text-gray-900 text-sm">Two-Factor Authentication</h2>
        </div>
        <div className="p-6 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
            <Icon.PiDeviceMobileBold size={20} />
          </div>
          <div className="flex-1">
            <p className="font-bold text-gray-900 text-sm mb-1">Authenticator App</p>
            <p className="text-xs text-gray-500 leading-relaxed">
              Add an extra layer of security. Each time you log in, you will need your password plus a verification code from your phone.
            </p>
            <button className="mt-3 flex items-center gap-2 border border-gray-200 text-gray-700 px-4 py-2 rounded-xl text-xs font-bold hover:border-red-200 hover:text-red-700 transition-all">
              <Icon.PiPlusBold size={12} /> Enable 2FA
            </button>
          </div>
          <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full flex-shrink-0">Coming Soon</span>
        </div>
      </div>

      {/* ── Sessions ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Icon.PiDesktopBold size={15} className="text-red-700" />
          <h2 className="font-black text-gray-900 text-sm">Active Sessions</h2>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl">
            <div className="w-9 h-9 rounded-xl bg-green-100 text-green-700 flex items-center justify-center flex-shrink-0">
              <Icon.PiCheckCircleBold size={18} />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-gray-900">Current session</p>
              <p className="text-xs text-gray-500 mt-0.5">This device · Active now</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
          </div>
          <p className="text-xs text-gray-400 mt-3">
            If you notice any suspicious activity, change your password immediately and contact our support team.
          </p>
        </div>
      </div>

    </div>
  );
}
