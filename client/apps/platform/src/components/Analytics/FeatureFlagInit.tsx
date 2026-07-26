'use client';
import { useEffect } from 'react';
import { initFeatureFlags } from '@/lib/featureFlags';

export default function FeatureFlagInit() {
  useEffect(() => { initFeatureFlags(); }, []);
  return null;
}
