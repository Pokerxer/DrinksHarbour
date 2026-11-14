'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

export interface CustomerDraft { firstName: string; lastName: string; email: string; phone: string; }

/** GET /api/users row — the User model exposes the phone as `phoneNumber`
 *  (the `phone` the manual order submits is the transcribed customer value). */
interface MatchedUser { _id: string; firstName?: string; lastName?: string; email?: string; phoneNumber?: string; }

export default function CustomerCard({ value, onChange, token }: {
  value: CustomerDraft; onChange: (v: CustomerDraft) => void; token: string;
}) {
  const [matches, setMatches] = useState<MatchedUser[] | null>(null);
  const [lookup, setLookup] = useState(false);

  // Live lookup on a settled email/phone — surfaces whether this will attach to
  // a registered account or remain a guest order BEFORE submission.
  useEffect(() => {
    const term = value.email.trim() || value.phone.trim();
    if (term.length < 5 || !token) { setMatches(null); return; }
    setLookup(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/api/users?search=${encodeURIComponent(term)}&limit=5`,
          { headers: { Authorization: `Bearer ${token}` } });
        const body = (await res.json()) as { success?: boolean; data?: { users?: MatchedUser[] } };
        setMatches(body.success ? (body.data?.users || []) : null);
      } catch { setMatches(null); } finally { setLookup(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [value.email, value.phone, token]);

  const field = (name: keyof CustomerDraft, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">{label}</label>
      <input type={type} value={value[name]} placeholder={placeholder}
        onChange={e => onChange({ ...value, [name]: e.target.value })}
        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100 outline-none" />
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2"><Icon.PiUserBold size={16} className="text-red-700" /> Customer (from WhatsApp)</h3>
        {lookup && <span className="text-xs text-gray-400 shrink-0">Checking account…</span>}
        {!lookup && matches && (matches.length > 0
          ? <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full shrink-0">Registered customer found — order attaches to their account</span>
          : <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full shrink-0">No account — will be a guest order</span>)}
      </div>
      <div className="p-5 grid sm:grid-cols-2 gap-4">
        {field('firstName', 'First name')}
        {field('lastName', 'Last name')}
        {field('email', 'Email', 'email', 'customer@example.com')}
        {field('phone', 'WhatsApp phone', 'tel', '+234…')}
        {matches && matches.length > 0 && (
          <div className="sm:col-span-2 space-y-1.5">
            <p className="text-xs font-semibold text-gray-500">Tap to fill from a matching account:</p>
            {matches.map(u => (
              <button key={u._id} type="button"
                onClick={() => onChange({ firstName: u.firstName || '', lastName: u.lastName || '', email: u.email || '', phone: u.phoneNumber || value.phone })}
                className="w-full text-left px-3 py-2 rounded-lg border border-gray-100 hover:border-red-200 hover:bg-red-50/40 text-sm">
                <span className="font-semibold text-gray-800">{[u.firstName, u.lastName].filter(Boolean).join(' ') || u.email}</span>
                <span className="text-xs text-gray-400 ml-2">{u.email}{u.phoneNumber ? ` · ${u.phoneNumber}` : ''}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
