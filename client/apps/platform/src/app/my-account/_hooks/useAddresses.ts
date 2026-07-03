'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Address, AddressFormData } from '../_types';
import { API_URL } from '@/lib/api';
import { fetchWithAuth } from '@/lib/fetchWithAuth';

interface UseAddressesReturn {
  addresses: Address[];
  loading: boolean;
  error: string | null;
  addAddress: (data: AddressFormData) => Promise<boolean>;
  updateAddress: (id: string, data: AddressFormData) => Promise<boolean>;
  deleteAddress: (id: string) => Promise<boolean>;
  setDefault: (id: string) => Promise<boolean>;
}

export function useAddresses(token: string | null): UseAddressesReturn {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAddresses = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetchWithAuth(`${API_URL}/api/addresses`);
      if (!res.ok) throw new Error('Failed to fetch addresses');
      const data = await res.json();
      setAddresses(data.data?.addresses || data.addresses || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const addAddress = useCallback(async (data: AddressFormData): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/addresses`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (res.ok) {
        const d = await res.json();
        const addr = d.data?.address || d.address || d.data;
        setAddresses(prev => [...prev, addr]);
        return true;
      }
      return false;
    } catch { return false; }
  }, [token]);

  const updateAddress = useCallback(async (id: string, data: AddressFormData): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/addresses/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
      });
      if (res.ok) {
        const d = await res.json();
        const addr = d.data?.address || d.address || d.data;
        setAddresses(prev => prev.map(x => x._id === id ? addr : x));
        return true;
      }
      return false;
    } catch { return false; }
  }, [token]);

  const deleteAddress = useCallback(async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/addresses/${id}`, { method: 'DELETE' });
      if (res.ok) { setAddresses(prev => prev.filter(x => x._id !== id)); return true; }
      return false;
    } catch { return false; }
  }, [token]);

  const setDefault = useCallback(async (id: string): Promise<boolean> => {
    if (!token) return false;
    try {
      const res = await fetchWithAuth(`${API_URL}/api/addresses/${id}/default`, { method: 'PUT' });
      if (res.ok) { setAddresses(prev => prev.map(x => ({ ...x, isDefault: x._id === id }))); return true; }
      return false;
    } catch { return false; }
  }, [token]);

  return { addresses, loading, error, addAddress, updateAddress, deleteAddress, setDefault };
}
