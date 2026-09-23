import type { CSSProperties, ReactNode } from 'react';

import cn from '@core/utils/class-names';

type TenantBrandStyle = CSSProperties & {
  '--primary-lighter': string;
  '--primary-default': string;
  '--primary-dark': string;
  '--primary-foreground': string;
};

/** DrinksHarbour wordmark palette: harbour red, white, and near-black. */
export const TENANT_BRAND_STYLE: TenantBrandStyle = {
  '--primary-lighter': '254 226 226',
  '--primary-default': '220 38 38',
  '--primary-dark': '153 27 27',
  '--primary-foreground': '255 255 255',
};

export function TenantBrandTheme({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div style={TENANT_BRAND_STYLE} className={cn('min-w-0', className)}>
      {children}
    </div>
  );
}
