'use client';

import { useEffect, useRef } from 'react';
import { gtagEvent } from '@/lib/gtag';

export function useOfferImpression<T extends HTMLElement>(source: string, identity?: string) {
  const element = useRef<T>(null);
  const seen = useRef(new Set<string>());
  useEffect(() => {
    const target = element.current;
    if (!target || !identity || seen.current.has(identity) || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5) || seen.current.has(identity)) return;
      seen.current.add(identity);
      gtagEvent('merchandising_view', { source, offer_id: identity });
      observer.disconnect();
    }, { threshold: 0.5 });
    observer.observe(target);
    return () => observer.disconnect();
  }, [source, identity]);
  return element;
}
