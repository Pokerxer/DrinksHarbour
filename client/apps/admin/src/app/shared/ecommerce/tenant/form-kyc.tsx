import type { TenantFormMeta } from './form-types';
'use client';

import { Text } from 'rizzui';
import cn from '@core/utils/class-names';

import { PiSealCheckBold, PiSealWarningBold } from 'react-icons/pi';

export function KycSummary({ meta }: { meta?: TenantFormMeta }) {
  const checks = meta?.kycChecks ?? [];
  const warnings = meta?.kycWarnings ?? [];

  if (!checks.length && !warnings.length && meta?.kycVerified === undefined) {
    return (
      <Text className="text-sm text-gray-400">
        No KYC run for this tenant. Checks are performed automatically for
        vendors who sign up through the public application form.
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {meta?.kycVerified ? (
          <>
            <PiSealCheckBold className="h-5 w-5 text-green-600" />
            <Text className="text-sm font-medium text-green-700">
              KYC verified
            </Text>
          </>
        ) : (
          <>
            <PiSealWarningBold className="h-5 w-5 text-amber-500" />
            <Text className="text-sm font-medium text-amber-700">
              KYC not verified
            </Text>
          </>
        )}
      </div>

      {checks.length > 0 && (
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-100">
          {checks.map((c, i: number) => (
            <div
              key={`${c.check}-${i}`}
              className="flex items-start gap-3 px-3 py-2"
            >
              <span
                className={cn(
                  'mt-1.5 h-2 w-2 flex-shrink-0 rounded-full',
                  c.skipped
                    ? 'bg-gray-300'
                    : c.passed
                      ? 'bg-green-400'
                      : 'bg-red-400'
                )}
              />
              <div className="min-w-0">
                <Text className="text-sm capitalize text-gray-700">
                  {String(c.check || '').replace(/_/g, ' ')}
                </Text>
                {c.detail && (
                  <Text className="text-xs text-gray-400">{c.detail}</Text>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="rounded-lg border border-amber-100 bg-amber-50 px-3 py-2">
          {warnings.map((w: string, i: number) => (
            <Text key={i} className="text-xs text-amber-800">
              • {w}
            </Text>
          ))}
        </div>
      )}
    </div>
  );
}
