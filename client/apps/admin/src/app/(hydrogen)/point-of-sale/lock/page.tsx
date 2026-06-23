import { Suspense } from 'react';
import POSLockScreen from '@/app/shared/point-of-sale/pos-lock-screen';

export const metadata = {
  title: 'Unlock POS',
};

function SuspenseFallback() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#7c6f9e]" />
  );
}

export default function POSLockPage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <POSLockScreen />
    </Suspense>
  );
}
