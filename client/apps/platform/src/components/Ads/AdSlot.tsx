'use client';

import { useEffect, useRef } from 'react';
import { ADSENSE_CLIENT_ID as CLIENT_ID } from '@/components/Analytics/GoogleAdSense';

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

export interface AdSlotProps {
  /** Ad unit slot ID from the AdSense dashboard (data-ad-slot). */
  slot: string;
  /** Ad format — defaults to responsive "auto". */
  format?: string;
  /** Whether the unit is full-width responsive. Defaults to true. */
  responsive?: boolean;
  /** Optional fixed style; defaults to a responsive block. */
  style?: React.CSSProperties;
  className?: string;
}

/**
 * Renders a single AdSense ad unit (<ins class="adsbygoogle">) and asks
 * AdSense to fill it after mount.
 *
 * Renders nothing when NEXT_PUBLIC_ADSENSE_CLIENT_ID is unset, so pages using
 * <AdSlot /> stay clean in environments where AdSense isn't configured.
 *
 * Usage:
 *   <AdSlot slot="1234567890" />
 */
export default function AdSlot({
  slot,
  format = 'auto',
  responsive = true,
  style,
  className,
}: AdSlotProps) {
  const pushed = useRef(false);

  useEffect(() => {
    if (!CLIENT_ID || pushed.current) return;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      pushed.current = true;
    } catch {
      // AdSense not ready / blocked — fail silently, nothing to recover.
    }
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <ins
      className={`adsbygoogle${className ? ` ${className}` : ''}`}
      style={style ?? { display: 'block' }}
      data-ad-client={CLIENT_ID}
      data-ad-slot={slot}
      data-ad-format={format}
      data-full-width-responsive={responsive ? 'true' : 'false'}
    />
  );
}
