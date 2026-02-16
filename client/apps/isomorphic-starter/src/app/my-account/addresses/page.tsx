'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  PiHouseLine,
  PiPackage,
  PiMapPin,
  PiUser,
  PiLockKey,
  PiSignOut,
  PiPlus,
  PiPencil,
  PiTrash,
  PiPhone,
  PiCheckCircle,
  PiMapPin as PiMapPinIcon,
  PiArrowLeft,
  PiArrowRight,
  PiX,
} from 'react-icons/pi';

interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  landmark?: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatar?: { url: string };
}

const AddressesPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [form, setForm] = useState({
    label: 'Home',
    fullName: '',
    phoneNumber: '',
    addressLine1: '',
    addressLine2: '',
    city: '',
    state: '',
    postalCode: '',
    country: 'Nigeria',
    landmark: '',
    isDefaultShipping: false,
    isDefaultBilling: false,
  });
  const [submitLoading, setSubmitLoading] = useState(false);
  const [error, setError] = useState('');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: PiHouseLine, href: '/my-account' },
    { id: 'orders', label: 'My Orders', icon: PiPackage, href: '/my-account/orders' },
    { id: 'addresses', label: 'My Addresses', icon: PiMapPin, href: '/my-account/addresses' },
    { id: 'settings', label: 'Account Settings', icon: PiUser, href: '/my-account/settings' },
    { id: 'password', label: 'Change Password', icon: PiLockKey, href: '/my-account/password' },
  ];

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    fetchUserData(token);
    fetchAddresses(token);
  }, [mounted, router]);

  const fetchUserData = async (token: string) => {
    try {
      const response = await fetch('http://localhost:5001/api/users/me', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success && data.data?.user) {
        setUser(data.data.user);
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  };

  const fetchAddresses = async (token: string) => {
    try {
      const response = await fetch('http://localhost:5001/api/addresses', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await response.json();
      if (data.success) {
        setAddresses(data.data.addresses || []);
      }
    } catch (error) {
      console.error('Error fetching addresses:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    setSubmitLoading(true);
    setError('');

    try {
      const url = editingAddress
        ? `http://localhost:5001/api/addresses/${editingAddress._id}`
        : 'http://localhost:5001/api/addresses';
      const method = editingAddress ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...form,
          user: user?._id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to save address');
      }

      await fetchAddresses(token);
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleDelete = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5001/api/addresses/${addressId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Failed to delete address');

      await fetchAddresses(token);
    } catch (error: any) {
      alert(error.message);
    }
  };

  const handleSetDefault = async (addressId: string, type: 'shipping' | 'billing') => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    try {
      const response = await fetch(`http://localhost:5001/api/addresses/${addressId}/default`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type }),
      });

      if (response.ok) {
        await fetchAddresses(token);
      }
    } catch (error) {
      console.error('Error setting default:', error);
    }
  };

  const resetForm = () => {
    setForm({
      label: 'Home',
      fullName: user?.firstName + ' ' + user?.lastName || '',
      phoneNumber: user?.phoneNumber || '',
      addressLine1: '',
      addressLine2: '',
      city: '',
      state: '',
      postalCode: '',
      country: 'Nigeria',
      landmark: '',
      isDefaultShipping: addresses.length === 0,
      isDefaultBilling: false,
    });
    setEditingAddress(null);
  };

  const openEditModal = (address: Address) => {
    setEditingAddress(address);
    setForm({
      label: address.label,
      fullName: address.fullName,
      phoneNumber: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || '',
      city: address.city,
      state: address.state,
      postalCode: address.postalCode || '',
      country: address.country,
      landmark: address.landmark || '',
      isDefaultShipping: address.isDefaultShipping,
      isDefaultBilling: address.isDefaultBilling,
    });
    setShowModal(true);
  };

  const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
      home: 'bg-blue-100 text-blue-700',
      work: 'bg-purple-100 text-purple-700',
      office: 'bg-indigo-100 text-indigo-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[label.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const formatAddress = (address: Address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      `${address.city}, ${address.state} ${address.postalCode || ''}`.trim(),
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleMapClick = (address: Address) => {
    const query = encodeURIComponent(formatAddress(address));
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  };

  if (!mounted || loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
        <Link href="/" className="hover:text-gray-900">Home</Link>
        <PiArrowRight size={14} />
        <Link href="/my-account" className="hover:text-gray-900">My Account</Link>
        <PiArrowRight size={14} />
        <span className="text-gray-900">My Addresses</span>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="lg:w-1/4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden sticky top-4">
            <div className="p-6 bg-gradient-to-r from-gray-900 to-gray-800 text-white">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                  {user?.avatar?.url ? (
                    <Image src={user.avatar.url} alt="Avatar" width={64} height={64} className="rounded-full object-cover" />
                  ) : (
                    <PiUser size={32} className="text-white" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{user?.firstName} {user?.lastName}</h3>
                  <p className="text-white/70 text-sm truncate max-w-[200px]">{user?.email}</p>
                </div>
              </div>
            </div>

            <nav className="p-4">
              <ul className="space-y-1">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={item.href}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                        item.id === 'addresses'
                          ? 'bg-gray-900 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        item.id === 'addresses' ? 'bg-white/20' : 'bg-gray-100'
                      }`}>
                        <item.icon size={20} className={item.id === 'addresses' ? 'text-white' : 'text-orange-600'} />
                      </div>
                      <span className="font-medium">{item.label}</span>
                      {item.id === 'addresses' && addresses.length > 0 && (
                        <span className="ml-auto bg-orange-100 text-orange-700 text-xs px-2 py-0.5 rounded-full">
                          {addresses.length}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-6 pt-6 border-t border-gray-100">
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    sessionStorage.removeItem('token');
                    router.push('/login');
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-colors"
                >
                  <PiSignOut size={20} />
                  <span className="font-medium">Logout</span>
                </button>
              </div>
            </nav>
          </div>
        </div>

        <div className="lg:w-3/4">
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">My Addresses</h1>
                <p className="text-gray-500 mt-1">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</p>
              </div>
              <button
                onClick={() => {
                  resetForm();
                  setShowModal(true);
                }}
                className="px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                <PiPlus size={18} /> Add Address
              </button>
            </div>

            {addresses.length === 0 ? (
              <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                  <PiMapPin size={48} className="text-gray-400" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">No Addresses Yet</h2>
                <p className="text-gray-500 mb-8 max-w-md mx-auto">
                  Add an address to make checkout faster and easier. Your saved addresses will appear here.
                </p>
                <button
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium shadow-lg hover:shadow-xl"
                >
                  <PiPlus size={20} /> Add Your First Address
                </button>
              </div>
            ) : (
              <div className="grid md:grid-cols-2 gap-5">
                {addresses.map((address) => (
                  <div
                    key={address._id}
                    className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group"
                  >
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          {address.isDefaultShipping && (
                            <span className="px-2.5 py-1 bg-gray-900 text-white text-xs font-bold rounded-full flex items-center gap-1">
                              <PiCheckCircle size={12} /> Default Shipping
                            </span>
                          )}
                          {address.isDefaultBilling && !address.isDefaultShipping && (
                            <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full flex items-center gap-1">
                              <PiCheckCircle size={12} /> Default Billing
                            </span>
                          )}
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${getLabelColor(address.label)}`}>
                            {address.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => openEditModal(address)}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                            title="Edit"
                          >
                            <PiPencil size={16} />
                          </button>
                          <button
                            onClick={() => handleDelete(address._id)}
                            className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                            title="Delete"
                          >
                            <PiTrash size={16} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="font-semibold text-gray-900 text-lg">{address.fullName}</p>
                        <p className="text-gray-600">{address.addressLine1}</p>
                        {address.addressLine2 && <p className="text-gray-600">{address.addressLine2}</p>}
                        <p className="text-gray-600">
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                        <p className="text-gray-600">{address.country}</p>
                      </div>

                      {address.landmark && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <p className="text-sm text-gray-500">
                            <span className="font-medium">Landmark:</span> {address.landmark}
                          </p>
                        </div>
                      )}

                      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-500">
                          <PiPhone size={14} />
                          <span className="text-sm">{address.phone}</span>
                        </div>
                        <button
                          onClick={() => handleMapClick(address)}
                          className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                          <PiMapPinIcon size={14} /> View Map
                        </button>
                      </div>
                    </div>

                    <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                      {!address.isDefaultShipping && (
                        <button
                          onClick={() => handleSetDefault(address._id, 'shipping')}
                          className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors flex items-center gap-1"
                        >
                          <PiCheckCircle size={14} /> Set as Default Shipping
                        </button>
                      )}
                      {!address.isDefaultBilling && !address.isDefaultShipping && (
                        <button
                          onClick={() => handleSetDefault(address._id, 'billing')}
                          className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors flex items-center gap-1"
                        >
                          <PiCheckCircle size={14} /> Set as Default Billing
                        </button>
                      )}
                      {(address.isDefaultShipping || address.isDefaultBilling) && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <PiCheckCircle size={14} /> Default Set
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAddress ? 'Edit Address' : 'Add New Address'}
              </h2>
              <button
                onClick={() => {
                  setShowModal(false);
                  resetForm();
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <PiX size={20} className="text-gray-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Label</label>
                  <select
                    value={form.label}
                    onChange={(e) => setForm({ ...form, label: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  >
                    <option value="Home">Home</option>
                    <option value="Work">Work</option>
                    <option value="Office">Office</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                  <input
                    type="tel"
                    value={form.phoneNumber}
                    onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 1</label>
                <input
                  type="text"
                  value={form.addressLine1}
                  onChange={(e) => setForm({ ...form, addressLine1: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Street address"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Address Line 2</label>
                <input
                  type="text"
                  value={form.addressLine2}
                  onChange={(e) => setForm({ ...form, addressLine2: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Apartment, suite, etc. (optional)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={(e) => setForm({ ...form, state: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Postal Code</label>
                  <input
                    type="text"
                    value={form.postalCode}
                    onChange={(e) => setForm({ ...form, postalCode: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                  <input
                    type="text"
                    value={form.country}
                    onChange={(e) => setForm({ ...form, country: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Landmark</label>
                <input
                  type="text"
                  value={form.landmark}
                  onChange={(e) => setForm({ ...form, landmark: e.target.value })}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                  placeholder="Near landmark (optional)"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefaultShipping}
                    onChange={(e) => setForm({ ...form, isDefaultShipping: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Set as default shipping address</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isDefaultBilling}
                    onChange={(e) => setForm({ ...form, isDefaultBilling: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  <span className="text-sm text-gray-700">Set as default billing address</span>
                </label>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitLoading}
                  className="flex-1 px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors font-medium disabled:opacity-50"
                >
                  {submitLoading ? 'Saving...' : editingAddress ? 'Update Address' : 'Add Address'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AddressesPage;
