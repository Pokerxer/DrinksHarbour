'use client';

import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { API_URL } from '@/lib/api';

const NG_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno','Cross River',
  'Delta','Ebonyi','Edo','Ekiti','Enugu','FCT Abuja','Gombe','Imo','Jigawa','Kaduna','Kano',
  'Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa','Niger','Ogun','Ondo','Osun','Oyo',
  'Plateau','Rivers','Sokoto','Taraba','Yobe','Zamfara',
];

const BLANK = {
  label: 'Home' as string,
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
  isDefault: false,
};

const inputCls = 'w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none transition-all';
const labelCls = 'text-xs font-semibold text-gray-600 mb-1.5 block';

export default function AddressesPage() {
  const { token } = useAccount();
  const [addresses, setAddresses]   = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState<string | null>(null);
  const [showForm, setShowForm]     = useState(false);
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [form, setForm]             = useState(BLANK);

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/addresses`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setAddresses(data.data?.addresses || data.addresses || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const openAdd = () => { setForm(BLANK); setEditingId(null); setShowForm(true); };
  const openEdit = (addr: any) => {
    setForm({
      label: addr.label || 'Home',
      firstName: addr.firstName || '',
      lastName: addr.lastName || '',
      phone: addr.phone || '',
      address: addr.address || addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      country: addr.country || 'Nigeria',
      isDefault: addr.isDefault ?? false,
    });
    setEditingId(addr._id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); setForm(BLANK); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    try {
      const url    = editingId ? `${API_URL}/api/addresses/${editingId}` : `${API_URL}/api/addresses`;
      const method = editingId ? 'PUT' : 'POST';
      const res    = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        const data = await res.json();
        const addr = data.data?.address || data.address || data.data;
        if (editingId) {
          setAddresses(a => a.map(x => x._id === editingId ? addr : x));
        } else {
          setAddresses(a => [...a, addr]);
        }
        closeForm();
      }
    } catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setDeleting(id);
    try {
      const res = await fetch(`${API_URL}/api/addresses/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAddresses(a => a.filter(x => x._id !== id));
    } catch {}
    finally { setDeleting(null); }
  };

  const handleSetDefault = async (id: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/addresses/${id}/default`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setAddresses(a => a.map(x => ({ ...x, isDefault: x._id === id })));
    } catch {}
  };

  const LABEL_ICONS: Record<string, React.ElementType> = {
    Home: Icon.PiHouseBold,
    Work: Icon.PiBriefcaseBold,
    Other: Icon.PiMapPinBold,
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Addresses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your delivery addresses</p>
        </div>
        {!showForm && (
          <button
            onClick={openAdd}
            className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
          >
            <Icon.PiPlusBold size={14} /> Add Address
          </button>
        )}
      </div>

      {/* ── Add / Edit form ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="font-black text-gray-900 text-sm flex items-center gap-2">
                <Icon.PiMapPinBold size={15} className="text-red-700" />
                {editingId ? 'Edit Address' : 'Add New Address'}
              </h2>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600">
                <Icon.PiXBold size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Label + default */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Label</label>
                  <select value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} className={inputCls}>
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
                      onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
                      className="w-4 h-4 rounded accent-red-700"
                    />
                    <span className="text-sm font-medium text-gray-700">Set as default address</span>
                  </label>
                </div>
              </div>

              {/* Name */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>First Name</label>
                  <input required value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>Last Name</label>
                  <input required value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} className={inputCls} />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className={labelCls}>Phone Number</label>
                <input type="tel" required placeholder="+234 800 000 0000" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} />
              </div>

              {/* Street */}
              <div>
                <label className={labelCls}>Street Address</label>
                <input required placeholder="House number, street name" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inputCls} />
              </div>

              {/* City + State */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>City</label>
                  <input required value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className={labelCls}>State</label>
                  <select required value={form.state} onChange={e => setForm(f => ({ ...f, state: e.target.value }))} className={inputCls}>
                    <option value="">Select state…</option>
                    {NG_STATES.map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-60"
                >
                  {saving ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Saving…</> : (editingId ? 'Update Address' : 'Save Address')}
                </button>
                <button type="button" onClick={closeForm} className="px-5 py-2.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:border-red-200 hover:text-red-700 transition-all">
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Address list ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 flex justify-center">
          <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
        </div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-14 text-center">
          <Icon.PiMapPinBold size={44} className="mx-auto text-gray-200 mb-4" />
          <p className="font-black text-gray-800 text-lg mb-1">No saved addresses</p>
          <p className="text-sm text-gray-400 mb-6">Save delivery addresses for faster checkout.</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm"
          >
            <Icon.PiPlusBold size={14} /> Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map((addr: any) => {
            const LabelIcon = LABEL_ICONS[addr.label] ?? Icon.PiMapPinBold;
            return (
              <div
                key={addr._id}
                className={`bg-white rounded-2xl border shadow-sm p-5 transition-all ${addr.isDefault ? 'border-red-200' : 'border-gray-100 hover:border-red-100'}`}
              >
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-red-50 text-red-700 flex items-center justify-center flex-shrink-0">
                      <LabelIcon size={15} />
                    </div>
                    <span className="font-black text-sm text-gray-900">{addr.label || 'Address'}</span>
                    {addr.isDefault && (
                      <span className="text-[10px] font-bold bg-red-700 text-white px-2 py-0.5 rounded-full">Default</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(addr)}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-700 transition-all"
                    >
                      <Icon.PiPencilSimple size={13} />
                    </button>
                    <button
                      onClick={() => handleDelete(addr._id)}
                      disabled={deleting === addr._id}
                      className="w-7 h-7 rounded-lg border border-gray-200 flex items-center justify-center text-gray-400 hover:border-red-200 hover:text-red-600 transition-all disabled:opacity-40"
                    >
                      {deleting === addr._id
                        ? <div className="w-3 h-3 border border-red-300 border-t-red-600 rounded-full animate-spin" />
                        : <Icon.PiTrashBold size={13} />}
                    </button>
                  </div>
                </div>

                <p className="text-sm font-semibold text-gray-900">{addr.firstName} {addr.lastName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{addr.address || addr.street}</p>
                <p className="text-xs text-gray-500">{addr.city}{addr.state ? `, ${addr.state}` : ''}</p>
                {addr.phone && <p className="text-xs text-gray-400 mt-1">{addr.phone}</p>}

                {!addr.isDefault && (
                  <button
                    onClick={() => handleSetDefault(addr._id)}
                    className="mt-3 text-xs font-semibold text-red-700 hover:underline"
                  >
                    Set as default
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
