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
  PiArrowRight,
} from 'react-icons/pi';

interface User {
  _id: string;
  firstName: string;
  lastName: string;
  email: string;
  avatar?: { url: string };
}

const PasswordPage = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [loadingSave, setLoadingSave] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) return;

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoadingSave(true);
      setError('');
      setSuccess('');

    try {
      const response = await fetch('http://localhost:5001/api/users/change-password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to change password');
      }

      setSuccess('Password changed successfully!');
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoadingSave(false);
    }
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
        <span className="text-gray-900">Change Password</span>
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
                        item.id === 'password'
                          ? 'bg-gray-900 text-white shadow-lg'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        item.id === 'password' ? 'bg-white/20' : 'bg-gray-100'
                      }`}>
                        <item.icon size={20} className={item.id === 'password' ? 'text-white' : 'text-red-600'} />
                      </div>
                      <span className="font-medium">{item.label}</span>
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
            <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              {error && (
                <div className="mb-4 p-4 bg-red-50 text-red-600 rounded-lg text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-4 bg-green-50 text-green-600 rounded-lg text-sm">
                  {success}
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                  <input
                    type="password"
                    value={form.currentPassword}
                    onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                  <input
                    type="password"
                    value={form.newPassword}
                    onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                    minLength={8}
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum 8 characters with uppercase, lowercase, number and special character</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                  <input
                    type="password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-gray-900"
                    required
                  />
                </div>
                <button type="submit" disabled={loadingSave} className="px-6 py-3 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-colors disabled:opacity-50">
                  {loadingSave ? 'Updating...' : 'Update Password'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PasswordPage;
