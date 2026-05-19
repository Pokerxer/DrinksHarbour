// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

export interface POSTenant {
  _id: string;
  slug: string;
  name: string;
  primaryColor?: string;
  logo?: { url: string; alt?: string } | null;
}

export interface POSUser {
  _id: string;
  firstName: string;
  lastName: string;
  posName?: string;
  role?: string;
  posPermissions?: string[];
  avatar?: string | null;
}

export interface POSAuthState {
  posToken: string | null;
  posUser: POSUser | null;
  posTenant: POSTenant | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  logout: () => void;
}

/** Manually decode a JWT payload (no library). Returns null if invalid. */
function decodeJWT(token: string): Record<string, any> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = parts[1];
    // Base64url → base64 → JSON
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const payload = decodeJWT(token);
  if (!payload) return true;
  if (!payload.exp) return false; // No expiry = never expires
  // exp is in seconds, Date.now() is in ms
  return Date.now() >= payload.exp * 1000;
}

export function usePOSAuth(): POSAuthState {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [posToken, setPosToken] = useState<string | null>(null);
  const [posUser, setPosUser] = useState<POSUser | null>(null);
  const [posTenant, setPosTenant] = useState<POSTenant | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') {
      setIsLoading(false);
      return;
    }

    try {
      const token = localStorage.getItem('pos_token');
      const staffRaw = localStorage.getItem('pos_staff');
      const tenantRaw = localStorage.getItem('pos_tenant');

      if (!token || isTokenExpired(token)) {
        setPosToken(null);
        setPosUser(null);
        setPosTenant(null);
        setIsLoading(false);
        return;
      }

      setPosToken(token);

      if (staffRaw) {
        try {
          const staff = JSON.parse(staffRaw);
          setPosUser({
            _id: staff._id,
            firstName: staff.firstName,
            lastName: staff.lastName,
            posName: staff.posName,
            role: staff.role,
            posPermissions: staff.posPermissions,
            avatar: staff.avatar,
          });
        } catch {
          setPosUser(null);
        }
      }

      if (tenantRaw) {
        try {
          const tenant = JSON.parse(tenantRaw);
          setPosTenant({
            _id: tenant._id,
            slug: tenant.slug,
            name: tenant.name,
            primaryColor: tenant.primaryColor,
            logo: tenant.logo,
          });
        } catch {
          setPosTenant(null);
        }
      }
    } catch (err) {
      console.error('[usePOSAuth] Error reading localStorage:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_staff');
    localStorage.removeItem('pos_tenant');
    setPosToken(null);
    setPosUser(null);
    setPosTenant(null);
    router.push('/pos/login');
  }, [router]);

  const isAuthenticated = !!posToken && !isLoading;

  return {
    posToken,
    posUser,
    posTenant,
    isLoading,
    isAuthenticated,
    logout,
  };
}
