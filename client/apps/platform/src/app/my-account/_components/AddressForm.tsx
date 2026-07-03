'use client';
import React from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import type { AddressFormData } from '../_types';
import { NG_STATES, inputCls, labelCls } from '../_constants';

interface Props {
  form: AddressFormData;
  onChange: (data: AddressFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  saving: boolean;
  editing: boolean;
}

const update = (prev: AddressFormData, patch: Partial<AddressFormData>) => ({ ...prev, ...patch });

export default function AddressForm({ form, onChange, onSubmit, onCancel, saving, editing }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-white rounded-xl border border-stone-100 shadow-sm overflow-hidden"
    >
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
        <h2 className="font-black text-stone-900 text-sm flex items-center gap-2">
          <Icon.PiMapPinBold size={15} className="text-red-700" />
          {editing ? 'Edit Address' : 'Add New Address'}
        </h2>
        <button onClick={onCancel} className="text-stone-400 hover:text-stone-600 transition-all">
          <Icon.PiXBold size={16} />
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-4">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>Label</label>
            <select
              value={form.label}
              onChange={e => onChange(update(form, { label: e.target.value }))}
              className={inputCls}
            >
              <option>Home</option>
              <option>Work</option>
              <option>Other</option>
            </select>
          </div>
          <div className="flex items-end pb-2.5">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={e => onChange(update(form, { isDefault: e.target.checked }))}
                className="w-4 h-4 rounded accent-red-700"
              />
              <span className="text-sm font-medium text-stone-700">Set as default address</span>
            </label>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>First Name</label>
            <input
              required
              value={form.firstName}
              onChange={e => onChange(update(form, { firstName: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>Last Name</label>
            <input
              required
              value={form.lastName}
              onChange={e => onChange(update(form, { lastName: e.target.value }))}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Phone Number</label>
          <input
            type="tel"
            required
            placeholder="+234 800 000 0000"
            value={form.phone}
            onChange={e => onChange(update(form, { phone: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Street Address</label>
          <input
            required
            placeholder="House number, street name"
            value={form.address}
            onChange={e => onChange(update(form, { address: e.target.value }))}
            className={inputCls}
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={labelCls}>City</label>
            <input
              required
              value={form.city}
              onChange={e => onChange(update(form, { city: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div>
            <label className={labelCls}>State</label>
            <select
              required
              value={form.state}
              onChange={e => onChange(update(form, { state: e.target.value }))}
              className={inputCls}
            >
              <option value="">Select state&hellip;</option>
              {NG_STATES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-800 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-900 transition-all disabled:opacity-60"
          >
            {saving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving&hellip;
              </>
            ) : (
              editing ? 'Update Address' : 'Save Address'
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 border border-stone-200 rounded-xl text-sm font-semibold text-stone-600 hover:border-red-200 hover:text-red-700 transition-all"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}
