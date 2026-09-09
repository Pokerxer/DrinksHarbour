import type { Metadata } from 'next';

export const HOME_TITLE = 'Buy Drinks Online in Nigeria | DrinksHarbour';
export const HOME_DESCRIPTION = 'Buy drinks online in Nigeria with DrinksHarbour. Shop wines, spirits, beer and non-alcoholic drinks, compare prices and order delivery in Abuja and nationwide.';
const url = process.env.NEXT_PUBLIC_BASE_URL || 'https://www.drinksharbour.com';

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
