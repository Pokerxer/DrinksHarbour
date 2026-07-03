'use client';

import React, { useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import * as Icon from 'react-icons/pi';
import { useAccount } from '../AccountShell';
import { useAddresses } from '../_hooks/useAddresses';
import type { Address, AddressFormData } from '../_types';
import AddressCard from '../_components/AddressCard';
import AddressForm from '../_components/AddressForm';

const BLANK_FORM: AddressFormData = {
  label: 'Home',
  firstName: '',
  lastName: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  country: 'Nigeria',
  isDefault: false,
};

export default function AddressesPage() {
  const { token } = useAccount();
  const { addresses, loading, addAddress, updateAddress, deleteAddress, setDefault } = useAddresses(token);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AddressFormData>(BLANK_FORM);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setForm(BLANK_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (addr: Address) => {
    setForm({
      label: addr.label,
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone,
      address: addr.address || addr.street || '',
      city: addr.city,
      state: addr.state,
      country: addr.country,
      isDefault: addr.isDefault,
    });
    setEditingId(addr._id);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(BLANK_FORM);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const ok = editingId
      ? await updateAddress(editingId, form)
      : await addAddress(form);
    if (ok) closeForm();
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    await deleteAddress(id);
    setDeleting(null);
  };

  const handleSetDefault = async (id: string) => {
    await setDefault(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Addresses</h1>
          <p className="text-sm text-stone-500 mt-0.5">Manage your delivery addresses</p>
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

      <AnimatePresence>
        {showForm && (
          <AddressForm
            form={form}
            onChange={setForm}
            onSubmit={handleSubmit}
            onCancel={closeForm}
            saving={saving}
            editing={!!editingId}
          />
        )}
      </AnimatePresence>

      {loading ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-10 flex justify-center">
          <div className="w-8 h-8 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
        </div>
      ) : addresses.length === 0 && !showForm ? (
        <div className="bg-white rounded-xl border border-stone-200 shadow-sm p-14 text-center">
          <Icon.PiMapPinBold size={44} className="mx-auto text-stone-200 mb-4" />
          <p className="font-black text-stone-800 text-lg mb-1">No saved addresses</p>
          <p className="text-sm text-stone-400 mb-6">Save delivery addresses for faster checkout.</p>
          <button
            onClick={openAdd}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all"
          >
            <Icon.PiPlusBold size={14} /> Add Your First Address
          </button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {addresses.map(addr => (
            <AddressCard
              key={addr._id}
              address={addr}
              onEdit={() => openEdit(addr)}
              onDelete={() => handleDelete(addr._id)}
              onSetDefault={() => handleSetDefault(addr._id)}
              deleting={deleting === addr._id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
