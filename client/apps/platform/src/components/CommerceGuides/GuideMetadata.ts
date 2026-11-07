import type { Metadata } from 'next';
import { withSocialMetadata } from '@/lib/socialMetadata';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';

export const GUIDE_ORIGIN = publicSiteOrigin();

export function guideMetadata(path: string, title: string, description: string): Metadata {
  return withSocialMetadata({
    title: { absolute: `${title} | DrinksHarbour` }, description,
    alternates: { canonical: `${GUIDE_ORIGIN}${path}`, languages: { 'en-NG': `${GUIDE_ORIGIN}${path}`, 'x-default': `${GUIDE_ORIGIN}${path}` } },
  });
}
