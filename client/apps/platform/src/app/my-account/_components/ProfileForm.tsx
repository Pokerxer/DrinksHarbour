'use client';
import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import type { AuthUser } from '@/context/AuthContext';
import { inputCls, labelCls } from '../_constants';

interface ProfileFormProps {
  form: { firstName: string; lastName: string; phone: string };
  user: AuthUser;
  saving: boolean;
  saved: boolean;
  onChange: (field: string, value: string) => void;
  onSave: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function ProfileForm({ form, user, saving, saved, onChange, onSave, onCancel }: ProfileFormProps) {
  return (
    <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiUserBold size={15} className="text-red-700" /> Profile Information
        </h2>
      </div>

      <AnimatePresence mode="wait">
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mx-6 mt-4 flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5"
          >
            <Icon.PiCheckCircleFill size={16} className="text-green-600" />
            <p className="text-sm text-green-700 font-medium">Profile updated successfully!</p>
          </motion.div>
        )}
      </AnimatePresence>

      <form onSubmit={onSave} className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input value={form.firstName} onChange={e => onChange('firstName', e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input value={form.lastName} onChange={e => onChange('lastName', e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Phone Number</label>
          <input type="tel" value={form.phone} onChange={e => onChange('phone', e.target.value)} placeholder="+234 800 000 0000" className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Email Address</label>
          <input type="email" value={user.email || ''} disabled className={`${inputCls} opacity-60 cursor-not-allowed`} />
          <p className="text-xs text-stone-400 mt-1">Email cannot be changed here. Contact support.</p>
        </div>
        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60"
          >
            {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : 'Save Changes'}
          </button>
          <button type="button" onClick={onCancel} className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:border-red-200 hover:text-red-700 transition-all">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
