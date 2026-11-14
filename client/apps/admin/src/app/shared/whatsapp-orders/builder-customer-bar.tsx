'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface CustomerDraft { firstName: string; lastName: string; email: string; phone: string; }

/** GET /api/users row — the User model exposes the phone as `phoneNumber`
 *  (the `phone` the manual order submits is the transcribed customer value). */
interface MatchedUser { _id: string; firstName?: string; lastName?: string; email?: string; phoneNumber?: string; }

export default function BuilderCustomerBar({ value, onChange, token, onStatus }: {
  value: CustomerDraft; onChange: (v: CustomerDraft) => void; token: string;
  /** Lifted into the orchestrator so the header can show the live account status. */
  onStatus: (text: string) => void;
}) {
  const [matches, setMatches] = useState<MatchedUser[] | null>(null);
  const [lookup, setLookup] = useState(false);

  // Live lookup on a settled email/phone — the v1 customer-card logic verbatim:
  // surfaces whether this will attach to a registered account or remain a
  // guest order BEFORE submission.
  useEffect(() => {
    const term = value.email.trim() || value.phone.trim();
    if (term.length < 5 || !token) { setMatches(null); onStatus('Guest order'); return; }
    onStatus('Checking…');
    setLookup(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/users?search=${encodeURIComponent(term)}&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } });
        const body = (await res.json()) as { success?: boolean; data?: { users?: MatchedUser[] } };
        const found = body.success ? (body.data?.users || []) : null;
        setMatches(found);
        onStatus(found && found.length > 0
          ? 'Registered customer — attaches to their account'
          : 'Guest order');
      } catch { setMatches(null); onStatus('Guest order'); } finally { setLookup(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [value.email, value.phone, token, onStatus]);

  const field = (name: keyof CustomerDraft, label: string, type = 'text', placeholder = '') => (
    <input type={type} value={value[name]} placeholder={placeholder} aria-label={label}
      onChange={e => onChange({ ...value, [name]: e.target.value })}
      className="w-full min-w-0 rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 outline-none focus:border-brand focus:bg-white" />
  );

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h3 className="flex items-center gap-2 font-lexend text-sm font-bold text-gray-900">
          <Icon.PiUserBold size={14} className="text-brand" /> Customer (from WhatsApp)
        </h3>
        {lookup && <span className="shrink-0 text-xs text-gray-400">Checking account…</span>}
        {!lookup && matches && (matches.length > 0
          ? <span className="shrink-0 rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">Registered customer</span>
          : <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Guest order</span>)}
      </div>
      <div className="p-4">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {field('firstName', 'First name')}
          {field('lastName', 'Last name')}
          {field('email', 'Email', 'email', 'customer@example.com')}
          {field('phone', 'WhatsApp phone', 'tel', '+234…')}
        </div>
        {matches && matches.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Tap to fill:</span>
            {matches.map(u => (
              <button key={u._id} type="button"
                onClick={() => onChange({ firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '', phone: u.phoneNumber || value.phone })}
                className="rounded-lg border border-gray-100 px-2.5 py-1 text-xs hover:border-brand hover:bg-brand/5">
                <span className="font-semibold text-gray-800">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</span>
                <span className="ml-1.5 text-gray-400">{u.email}{u.phoneNumber ? ` · ${u.phoneNumber}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
