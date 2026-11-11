import { NATIONWIDE_DELIVERY_PROMISE } from '@/lib/deliveryCopy';
import type { Metadata } from 'next';
import { publicSiteOrigin } from '@/lib/publicSiteOrigin';

export const HOME_TITLE = 'Buy Drinks Online in Nigeria | DrinksHarbour';
export const HOME_DESCRIPTION = `Shop wine, spirits, beer and non-alcoholic drinks online. ${NATIONWIDE_DELIVERY_PROMISE}`;
const url = publicSiteOrigin();

export const homeMetadata: Metadata = {
  title: { absolute: HOME_TITLE },
  description: HOME_DESCRIPTION,
  alternates: { canonical: url, languages: { 'en-NG': url, 'x-default': url } },
  openGraph: {
    type: 'website', url, siteName: 'DrinksHarbour', locale: 'en_NG',
    title: HOME_TITLE, description: HOME_DESCRIPTION,
    images: [{ url: '/og-default.jpg', width: 1200, height: 630, alt: 'DrinksHarbour drinks delivery' }],
  },
  twitter: {
    card: 'summary_large_image', title: HOME_TITLE,
    description: HOME_DESCRIPTION, images: ['/og-default.jpg'],
  },
};
