'use client';

import React, { useState, useEffect } from 'react';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';
import { useAccount } from '../AccountShell';
import type { NotificationSettings } from '../_types';
import { DEFAULT_NOTIFICATION_SETTINGS } from '../_constants';
import ToggleSwitch from '../_components/ToggleSwitch';

const NOTIFICATION_TYPES = [
  { id: 'orderUpdates' as const, label: 'Order Updates',     description: 'Shipping, delivery, and status changes for your orders', icon: Icon.PiPackageBold,    color: 'bg-blue-50 text-blue-700' },
  { id: 'promotions' as const,   label: 'Promotional Offers', description: 'Exclusive deals, discounts, and flash sales',            icon: Icon.PiTagBold,         color: 'bg-orange-50 text-orange-700' },
  { id: 'newArrivals' as const,  label: 'New Arrivals',       description: 'Be first to know about new products in stock',           icon: Icon.PiSparkle,         color: 'bg-purple-50 text-purple-700' },
  { id: 'newsletter' as const,   label: 'Newsletter',         description: 'Weekly drink guides, recipes, and lifestyle tips',       icon: Icon.PiNewspaperBold,   color: 'bg-green-50 text-green-700' },
];

const CHANNEL_TYPES = [
  { id: 'email' as const,    label: 'Email',     description: 'Receive notifications to your registered email address',   icon: Icon.PiEnvelopeBold,       color: 'bg-red-50 text-red-700' },
  { id: 'sms' as const,      label: 'SMS',       description: 'Get text messages to your registered phone number',        icon: Icon.PiDeviceMobileBold,   color: 'bg-blue-50 text-blue-700' },
  { id: 'whatsapp' as const, label: 'WhatsApp',  description: 'Get updates directly on WhatsApp',                        icon: Icon.PiWhatsappLogoBold,   color: 'bg-green-50 text-green-700' },
  { id: 'push' as const,     label: 'Push',      description: 'Browser push notifications (coming soon)',                 icon: Icon.PiBellBold,           color: 'bg-amber-50 text-amber-700' },
];

export default function NotificationsPage() {
  const { token } = useAccount();
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetchWithAuth(`${API_URL}/api/users/notifications`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setSettings(data.settings || data.data?.settings || data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const toggle = (key: keyof NotificationSettings) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/users/notifications`, {
        method: 'PUT', body: JSON.stringify({ settings }),
      });
      if (res.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } catch {}
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900">Notifications</h1>
          <p className="text-sm text-stone-500 mt-0.5">Choose what you want to be notified about</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${
            saved
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-gradient-to-br from-red-700 to-red-800 text-white hover:from-red-800 hover:to-red-900 shadow-sm'
          } disabled:opacity-60`}
        >
          {saving
            ? <Icon.PiSpinnerBold size={14} className="animate-spin" />
            : saved
              ? <><Icon.PiCheckBold size={14} /> Saved!</>
              : <><Icon.PiFloppyDiskBold size={14} /> Save Preferences</>
          }
        </button>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
          <Icon.PiBellBold size={15} className="text-red-700" />
          <h2 className="font-black text-stone-900 text-sm">Notification Types</h2>
        </div>
        <div className="divide-y divide-stone-50">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-6 py-4 animate-pulse">
                  <div className="w-9 h-9 rounded-xl bg-stone-100 flex-shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 w-28 bg-stone-100 rounded" />
                    <div className="h-3 w-48 bg-stone-100 rounded" />
                  </div>
                  <div className="w-11 h-6 bg-stone-100 rounded-full" />
                </div>
              ))
            : NOTIFICATION_TYPES.map(({ id, label, description, icon: Ic, color }) => (
                <div key={id} className="flex items-center gap-4 px-6 py-4">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Ic size={17} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-stone-900">{label}</p>
                    <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{description}</p>
                  </div>
                  <ToggleSwitch enabled={settings[id]} onChange={() => toggle(id)} />
                </div>
              ))
          }
        </div>
      </div>

      <div className="bg-white rounded-xl border border-stone-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-stone-100">
          <Icon.PiChatTeardropBold size={15} className="text-red-700" />
          <h2 className="font-black text-stone-900 text-sm">Delivery Channels</h2>
        </div>
        <div className="divide-y divide-stone-50">
          {CHANNEL_TYPES.map(({ id, label, description, icon: Ic, color }) => (
            <div key={id} className="flex items-center gap-4 px-6 py-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Ic size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-stone-900">{label}</p>
                  {id === 'push' && (
                    <span className="text-[10px] font-bold bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </div>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <ToggleSwitch
                enabled={id === 'push' ? false : settings[id]}
                onChange={() => id !== 'push' && toggle(id)}
                disabled={id === 'push'}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-xl px-5 py-4">
        <Icon.PiInfoBold size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Transactional notifications (order confirmations, payment receipts) will always be sent regardless of your preferences above, as they contain important account information.
        </p>
      </div>
    </div>
  );
}
