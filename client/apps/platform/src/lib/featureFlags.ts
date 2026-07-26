export type FeatureFlag =
  | 'new_checkout_flow'
  | 'express_checkout'
  | 'product_recommendations_v2'
  | 'subscription_cta'
  | 'dynamic_pricing';

type FeatureVariant = 'control' | 'variant_a' | 'variant_b';

const FLAG_DEFAULTS: Record<FeatureFlag, boolean> = {
  new_checkout_flow: false,
  express_checkout: false,
  product_recommendations_v2: false,
  subscription_cta: false,
  dynamic_pricing: false,
};

let overrides: Record<string, boolean> = {};

export function initFeatureFlags(): void {
  if (typeof window === 'undefined') return;
  try {
    const stored = sessionStorage.getItem('dh_feature_flags');
    if (stored) {
      overrides = JSON.parse(stored);
      return;
    }
    const envFlags = process.env.NEXT_PUBLIC_FEATURE_FLAGS;
    if (envFlags) {
      overrides = JSON.parse(envFlags);
      sessionStorage.setItem('dh_feature_flags', JSON.stringify(overrides));
    }
  } catch {}
}

export function isEnabled(flag: FeatureFlag): boolean {
  if (flag in overrides) return overrides[flag];
  return FLAG_DEFAULTS[flag];
}

export function getVariant(experimentName: string, userId?: string): FeatureVariant {
  if (typeof window === 'undefined') return 'control';
  const storageKey = `dh_exp_${experimentName}`;
  const stored = sessionStorage.getItem(storageKey);
  if (stored && ['control', 'variant_a', 'variant_b'].includes(stored)) {
    return stored as FeatureVariant;
  }
  const seed = userId ?? Math.random().toString(36);
  const hash = seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const variants: FeatureVariant[] = ['control', 'variant_a', 'variant_b'];
  const assigned = variants[hash % variants.length];
  sessionStorage.setItem(storageKey, assigned);
  return assigned;
}

export function setOverride(flag: FeatureFlag, value: boolean): void {
  overrides[flag] = value;
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('dh_feature_flags', JSON.stringify(overrides));
  }
}

export function resetOverrides(): void {
  overrides = {};
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('dh_feature_flags');
  }
}

export function trackExperiment(experimentName: string, variant: string): void {
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', 'experiment_impression', {
      experiment_id: experimentName,
      experiment_variant: variant,
    });
  }
}
