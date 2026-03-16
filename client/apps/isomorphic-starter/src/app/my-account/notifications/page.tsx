'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState({
    orderUpdates: true,
    promotional: true,
    newArrivals: false,
    newsletter: true,
    sms: true,
    email: true,
  });

  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/my-account/notifications');
      return;
    }
    setLoading(false);
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-gray-300 border-t-gray-900 rounded-full" />
      </div>
    );
  }

  const ToggleSwitch = ({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) => (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
          <Link href="/my-account" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
            <Icon.PiArrowLeftBold /> Back to Account
          </Link>
        </div>

        <div className="bg-white rounded-2xl shadow-sm divide-y divide-gray-100">
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Notification Types</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Order Updates</p>
                  <p className="text-sm text-gray-500">Get notified about your order status</p>
                </div>
                <ToggleSwitch enabled={settings.orderUpdates} onChange={(v) => setSettings({ ...settings, orderUpdates: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Promotional Offers</p>
                  <p className="text-sm text-gray-500">Receive special deals and discounts</p>
                </div>
                <ToggleSwitch enabled={settings.promotional} onChange={(v) => setSettings({ ...settings, promotional: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">New Arrivals</p>
                  <p className="text-sm text-gray-500">Be the first to know about new products</p>
                </div>
                <ToggleSwitch enabled={settings.newArrivals} onChange={(v) => setSettings({ ...settings, newArrivals: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Newsletter</p>
                  <p className="text-sm text-gray-500">Receive our weekly newsletter</p>
                </div>
                <ToggleSwitch enabled={settings.newsletter} onChange={(v) => setSettings({ ...settings, newsletter: v })} />
              </div>
            </div>
          </div>

          <div className="p-6">
            <h2 className="text-lg font-semibold mb-4">Delivery Methods</h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">Email Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <ToggleSwitch enabled={settings.email} onChange={(v) => setSettings({ ...settings, email: v })} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">SMS Notifications</p>
                  <p className="text-sm text-gray-500">Receive notifications via SMS</p>
                </div>
                <ToggleSwitch enabled={settings.sms} onChange={(v) => setSettings({ ...settings, sms: v })} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}