/**
 * Host-injected configuration.
 *
 * This package is imported by both a Next.js app (NEXT_PUBLIC_*) and an Expo
 * app (EXPO_PUBLIC_*), so it cannot read the environment itself. Each host
 * calls configureCommerceCore() once at startup.
 */

interface CommerceCoreConfig {
  apiBaseUrl: string;
}

let config: CommerceCoreConfig | null = null;

export function configureCommerceCore(options: { apiBaseUrl: string }): void {
  if (!options?.apiBaseUrl) {
    throw new Error('configureCommerceCore: apiBaseUrl is required and must be non-empty');
  }
  config = { apiBaseUrl: options.apiBaseUrl.replace(/\/+$/, '') };
}

export function getApiBaseUrl(): string {
  if (!config) {
    throw new Error(
      'commerce-core used before configuration — call configureCommerceCore({ apiBaseUrl }) at app startup'
    );
  }
  return config.apiBaseUrl;
}

/** Test-only. Resets module state between cases. */
export function __resetCommerceCoreConfig(): void {
  config = null;
}
