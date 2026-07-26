'use client';

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
    _fbq?: unknown;
    ttq?: {
      track: (event: string, params?: Record<string, unknown>) => void;
      page: () => void;
      instance: (id: string) => void;
      [key: string]: unknown;
    };
    twq?: (...args: unknown[]) => void;
  }
}

function canTrackMarketing(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = localStorage.getItem('dh_consent');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.marketing === true;
    }
  } catch {}
  return false;
}

export function firePixelEvent(pixel: 'meta' | 'tiktok' | 'twitter', event: string, params?: Record<string, any>): void {
  if (!canTrackMarketing()) return;
  if (typeof window === 'undefined') return;

  switch (pixel) {
    case 'meta':
      if (window.fbq) {
        window.fbq('track', event, params);
      }
      break;
    case 'tiktok':
      if (window.ttq?.track) {
        window.ttq.track(event, params);
      }
      break;
    case 'twitter':
      if (window.twq) {
        window.twq('event', event, params);
      }
      break;
  }
}

export function fireAllPixels(event: string, params?: Record<string, any>): void {
  firePixelEvent('meta', event, params);
  firePixelEvent('tiktok', event, params);
  firePixelEvent('twitter', event, params);
}

export function firePurchase(params: { value: number; currency: string; content_ids: string[]; contents: Array<{ id: string; quantity: number }> }): void {
  fireAllPixels('Purchase', {
    value: params.value,
    currency: params.currency,
    content_ids: params.content_ids,
    contents: params.contents,
  });
}

export function fireAddToCart(params: { value: number; currency: string; content_ids: string[]; content_name?: string; content_type?: string }): void {
  fireAllPixels('AddToCart', {
    value: params.value,
    currency: params.currency,
    content_ids: params.content_ids,
    content_name: params.content_name,
    content_type: params.content_type,
  });
}

export function fireBeginCheckout(params: { value: number; currency: string; num_items: number }): void {
  fireAllPixels('InitiateCheckout', {
    value: params.value,
    currency: params.currency,
    num_items: params.num_items,
  });
}

export function fireViewContent(params: { content_name: string; content_ids: string[]; content_type?: string; value?: number; currency?: string }): void {
  fireAllPixels('ViewContent', {
    content_name: params.content_name,
    content_ids: params.content_ids,
    content_type: params.content_type,
    value: params.value,
    currency: params.currency,
  });
}
