'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import * as Icon from 'react-icons/pi';

interface Toggle {
  id: keyof typeof DEFAULTS;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
}

const DEFAULTS = {
  orderUpdates:  true,
  promotions:    true,
  newArrivals:   false,
  newsletter:    true,
  email:         true,
  sms:           true,
  push:          false,
  whatsapp:      true,
};

const NOTIFICATION_TYPES: Toggle[] = [
  { id: 'orderUpdates', label: 'Order Updates',     description: 'Shipping, delivery, and status changes for your orders', icon: Icon.PiPackageBold,    color: 'bg-blue-50 text-blue-700' },
  { id: 'promotions',   label: 'Promotional Offers', description: 'Exclusive deals, discounts, and flash sales',            icon: Icon.PiTagBold,         color: 'bg-orange-50 text-orange-700' },
  { id: 'newArrivals',  label: 'New Arrivals',       description: 'Be first to know about new products in stock',           icon: Icon.PiSparkle,         color: 'bg-purple-50 text-purple-700' },
  { id: 'newsletter',   label: 'Newsletter',         description: 'Weekly drink guides, recipes, and lifestyle tips',       icon: Icon.PiNewspaperBold,   color: 'bg-green-50 text-green-700' },
];

const CHANNEL_TYPES: Toggle[] = [
  { id: 'email',    label: 'Email',     description: 'Receive notifications to your registered email address',   icon: Icon.PiEnvelopeBold,       color: 'bg-red-50 text-red-700' },
  { id: 'sms',      label: 'SMS',       description: 'Get text messages to your registered phone number',        icon: Icon.PiDeviceMobileBold,   color: 'bg-blue-50 text-blue-700' },
  { id: 'whatsapp', label: 'WhatsApp',  description: 'Get updates directly on WhatsApp',                        icon: Icon.PiWhatsappLogoBold,   color: 'bg-green-50 text-green-700' },
  { id: 'push',     label: 'Push',      description: 'Browser push notifications (coming soon)',                 icon: Icon.PiBellBold,           color: 'bg-amber-50 text-amber-700' },
];

function ToggleSwitch({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-red-700' : 'bg-gray-200'}`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
      />
    </button>
  );
}

export default function NotificationsPage() {
  const [settings, setSettings] = useState(DEFAULTS);
  const [saved, setSaved]       = useState(false);

  const toggle = (key: keyof typeof DEFAULTS) =>
    setSettings(s => ({ ...s, [key]: !s[key] }));

  const handleSave = () => {
    // Would PUT to /api/users/notifications in production
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-500 mt-0.5">Choose what you want to be notified about</p>
        </div>
        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all flex-shrink-0 ${
            saved
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-gradient-to-br from-red-700 to-red-900 text-white hover:from-red-800 hover:to-red-950'
          }`}
        >
          {saved ? <><Icon.PiCheckBold size={14} /> Saved!</> : <><Icon.PiFloppyDiskBold size={14} /> Save Preferences</>}
        </button>
      </div>

      {/* ── Notification types ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Icon.PiBellBold size={15} className="text-red-700" />
          <h2 className="font-black text-gray-900 text-sm">Notification Types</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {NOTIFICATION_TYPES.map(({ id, label, description, icon: Ic, color }) => (
            <div key={id} className="flex items-center gap-4 px-6 py-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Ic size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <ToggleSwitch enabled={settings[id]} onChange={() => toggle(id)} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Channels ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100">
          <Icon.PiChatTeardropBold size={15} className="text-red-700" />
          <h2 className="font-black text-gray-900 text-sm">Delivery Channels</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {CHANNEL_TYPES.map(({ id, label, description, icon: Ic, color }) => (
            <div key={id} className="flex items-center gap-4 px-6 py-4">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                <Ic size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-gray-900">{label}</p>
                  {id === 'push' && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Soon</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{description}</p>
              </div>
              <ToggleSwitch
                enabled={id === 'push' ? false : settings[id]}
                onChange={() => id !== 'push' && toggle(id)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* ── Info banner ─────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3 bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4">
        <Icon.PiInfoBold size={16} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-blue-700 leading-relaxed">
          Transactional notifications (order confirmations, payment receipts) will always be sent regardless of your preferences above, as they contain important account information.
        </p>
      </div>

    </div>
  );
}
