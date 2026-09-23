import { Suspense } from 'react';
import PriceCheckerAnalytics from '@/app/shared/price-checker/analytics';
export default function Page() {
  return (
    <Suspense fallback={<p>Loading analytics…</p>}>
      <PriceCheckerAnalytics />
    </Suspense>
  );
}
