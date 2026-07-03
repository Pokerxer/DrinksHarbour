'use client';
import React, { useState } from 'react';
import * as Icon from 'react-icons/pi';
import { AnimatePresence, motion } from 'framer-motion';
import { inputCls } from '../_constants';
import { validateStrongPassword, getPasswordStrength } from '@/lib/validation';

function PasswordField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="text-xs font-semibold text-stone-600 mb-1.5 block">{label}</label>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputCls} pr-10`}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 transition-colors"
          tabIndex={-1}
        >
          {show ? <Icon.PiEyeSlashBold size={16} /> : <Icon.PiEyeBold size={16} />}
        </button>
      </div>
    </div>
  );
}

export function PasswordStrength({ password }: { password: string }) {
  const { score, label } = getPasswordStrength(password);
  const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-lime-500', 'bg-green-500'];
  const textColors = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-lime-500', 'text-green-500'];

  const criteria = [
    { label: 'At least 8 characters', met: password.length >= 8 },
    { label: 'Uppercase & lowercase letters', met: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'At least one number', met: /\d/.test(password) },
    { label: 'At least one special character (@$!%*?&)', met: /[@$!%*?&]/.test(password) },
  ] as const;

  return (
    <div className="space-y-2">
      <div className="flex gap-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
              password.length === 0 ? 'bg-stone-200' : i < score ? colors[score] : 'bg-stone-200'
            }`}
          />
        ))}
      </div>
      {password.length > 0 && (
        <p className={`text-xs font-semibold ${textColors[score]}`}>{label}</p>
      )}
      <div className="space-y-1 pt-1">
        {criteria.map(({ label: c, met }) => (
          <div key={c} className="flex items-center gap-2 text-xs">
            {met ? (
              <Icon.PiCheckCircleFill size={12} className="text-green-500" />
            ) : (
              <Icon.PiXBold size={11} className="text-stone-300" />
            )}
            <span className={met ? 'text-green-600' : 'text-stone-400'}>{c}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface PasswordFormProps {
  onSave: (data: { currentPassword: string; newPassword: string }) => Promise<{ success: boolean; message: string }>;
}

export default function PasswordForm({ onSave }: PasswordFormProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ success: boolean; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!currentPassword) {
      setMessage({ success: false, message: 'Current password is required.' });
      return;
    }

    const pwError = validateStrongPassword(newPassword);
    if (pwError) {
      setMessage({ success: false, message: pwError });
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage({ success: false, message: 'Passwords do not match.' });
      return;
    }

    setSaving(true);
    try {
      const result = await onSave({ currentPassword, newPassword });
      setMessage(result);
      if (result.success) {
        setCurrentPassword('');
        setConfirmPassword('');
      }
    } catch {
      setMessage({ success: false, message: 'An unexpected error occurred.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
        <Icon.PiLockBold size={15} className="text-red-700" />
        <h2 className="font-black text-stone-900 text-sm">Change Password</h2>
      </div>

      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={`mx-6 mt-4 flex items-center gap-2 rounded-xl px-4 py-2.5 ${
              message.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}
          >
            {message.success ? (
              <Icon.PiCheckCircleFill size={16} className="text-green-600" />
            ) : (
              <Icon.PiWarningCircleFill size={16} className="text-red-500" />
            )}
            <p className={`text-sm font-medium ${message.success ? 'text-green-700' : 'text-red-700'}`}>
              {message.message}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={handleSubmit} className="p-6 space-y-4">
        <PasswordField
          label="Current Password"
          value={currentPassword}
          onChange={setCurrentPassword}
          placeholder="Enter current password"
        />

        <div>
          <PasswordField
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            placeholder="Enter new password"
          />
          <div className="mt-2">
            <PasswordStrength password={newPassword} />
          </div>
        </div>

        <PasswordField
          label="Confirm New Password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          placeholder="Re-enter new password"
        />

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-900 transition-all disabled:opacity-60"
        >
          {saving ? (
            <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating&hellip;</>
          ) : (
            'Update Password'
          )}
        </button>
      </form>
    </div>
  );
}
