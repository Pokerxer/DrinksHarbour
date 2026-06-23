'use client';

import { useState, useEffect } from 'react';
import { Button, Title, Text, Loader } from 'rizzui';
import { useRouter } from 'next/navigation';
import { routes } from '@/config/routes';
import { posApi } from '@/app/shared/point-of-sale/api';
import { usePOSAuth } from '@/app/shared/point-of-sale/store';
import { POSStaff } from '@/app/shared/point-of-sale/types';
import { PiArrowLeft } from 'react-icons/pi';

export default function POSLogin() {
  const router = useRouter();
  const { setAuth, token } = usePOSAuth();
  const [tenantSlug, setTenantSlug] = useState('');
  const [staff, setStaff] = useState<POSStaff[]>([]);
  const [loading, setLoading] = useState(false);
  const [pinModal, setPinModal] = useState<POSStaff | null>(null);
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  useEffect(() => {
    if (token) router.push(routes.pos.index);
  }, [token, router]);

  async function handleLoadStaff() {
    if (!tenantSlug.trim()) return;
    setLoading(true);
    try {
      const data = await posApi.listStaff(tenantSlug.trim());
      setStaff(data.staff || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePinSubmit() {
    if (!pinModal || pin.length < 4) return;
    setLoggingIn(true);
    setPinError('');
    try {
      const data = await posApi.staffLogin(tenantSlug, pinModal._id, pin);
      setAuth(data.token, data.staff, data.tenant);
      router.push(routes.pos.index);
    } catch (err: any) {
      setPinError(err.message || 'Invalid PIN');
    } finally {
      setLoggingIn(false);
    }
  }

  if (token) return null;

  return (
    <div className="flex min-h-[80vh] items-center justify-center">
      <div className="w-full max-w-md">
        {!staff.length ? (
          <div className="space-y-6">
            <div className="text-center">
              <Title as="h2" className="mb-1">POS Login</Title>
              <Text className="text-gray-500">Enter your store slug to continue</Text>
            </div>
            <input
              value={tenantSlug}
              onChange={(e) => setTenantSlug(e.target.value)}
              placeholder="e.g. mystore"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-lg outline-none focus:border-gray-900"
              onKeyDown={(e) => e.key === 'Enter' && handleLoadStaff()}
            />
            <Button
              className="h-12 w-full text-base"
              onClick={handleLoadStaff}
              isLoading={loading}
              disabled={!tenantSlug.trim()}
            >
              Continue
            </Button>
          </div>
        ) : pinModal ? (
          <div className="space-y-6">
            <button onClick={() => { setPinModal(null); setPin(''); setPinError(''); }} className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700">
              <PiArrowLeft className="h-4 w-4" /> Back
            </button>
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                {pinModal.avatar ? <img src={pinModal.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : '👤'}
              </div>
              <Title as="h4">{pinModal.posName || `${pinModal.firstName} ${pinModal.lastName}`}</Title>
              <Text className="text-gray-500">Enter your PIN</Text>
            </div>
            <input
              type="password"
              value={pin}
              onChange={(e) => { setPin(e.target.value); setPinError(''); }}
              maxLength={6}
              placeholder="• • • •"
              className="w-full rounded-lg border border-gray-300 px-4 py-3 text-center text-2xl tracking-widest outline-none focus:border-gray-900"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handlePinSubmit()}
            />
            {pinError && <Text className="text-center text-sm text-red-500">{pinError}</Text>}
            <Button className="h-12 w-full text-base" onClick={handlePinSubmit} isLoading={loggingIn} disabled={pin.length < 4}>
              Sign In
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="text-center">
              <Title as="h3" className="mb-1">Select Staff</Title>
              <Text className="text-gray-500">Choose your name to log in</Text>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {staff.map((s) => (
                <button
                  key={s._id}
                  onClick={() => {
                    if (s.hasPin) {
                      setPinModal(s);
                    }
                  }}
                  className="flex flex-col items-center gap-2 rounded-xl border-2 border-gray-200 p-5 transition-all hover:border-gray-900 hover:bg-gray-50"
                >
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 text-2xl">
                    {s.avatar ? <img src={s.avatar} alt="" className="h-16 w-16 rounded-full object-cover" /> : '👤'}
                  </div>
                  <div className="text-center">
                    <Text className="text-sm font-medium">{s.posName || `${s.firstName} ${s.lastName}`}</Text>
                    <Text className="text-xs text-gray-400 capitalize">{s.role?.replace('_', ' ')}</Text>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStaff([])} className="block w-full text-center text-sm text-gray-400 hover:text-gray-600">
              Different store?
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
