'use client';

import { use } from 'react';
import { PhonePriceChecker, Unavailable } from './phone-checker';
import '@/components/price-checker/kiosk.css';
import '@/components/price-checker/kiosk-display.css';
import '@/components/price-checker/bottle-suggestions.css';
import '../../kiosk-phone.css';

export default function PhonePriceCheckerPage({
  params,
}: {
  params: Promise<{ kioskSlug: string; session: string }>;
}) {
  const { kioskSlug, session } = use(params);
  if (kioskSlug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(kioskSlug) ||
      !/^[a-z0-9-]{10,64}$/.test(session)) {
    return <Unavailable />;
  }
  return <PhonePriceChecker key={`${kioskSlug}:${session}`} slug={kioskSlug} session={session} />;
}
