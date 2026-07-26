'use client';

import { useState, useEffect } from 'react';
import { isEnabled, getVariant, initFeatureFlags, type FeatureFlag } from '@/lib/featureFlags';

export function useFeatureFlag(flag: FeatureFlag): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    initFeatureFlags();
    setEnabled(isEnabled(flag));
  }, [flag]);
  return enabled;
}

export function useExperimentVariant(experimentName: string): string {
  const [variant, setVariant] = useState('control');
  useEffect(() => {
    setVariant(getVariant(experimentName));
  }, [experimentName]);
  return variant;
}
