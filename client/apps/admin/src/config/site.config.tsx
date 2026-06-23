import { Metadata } from 'next';
import logoImg from '@public/logo.svg';
import { LAYOUT_OPTIONS } from '@/config/enums';
import logoIconImg from '@public/logo-short.svg';
import { OpenGraph } from 'next/dist/lib/metadata/types/opengraph-types';

enum MODE {
  DARK = 'dark',
  LIGHT = 'light',
}

export const siteConfig = {
  title: 'DrinksHarbour Admin',
  description: 'DrinksHarbour — Admin Dashboard',
  logo: logoImg,
  icon: logoIconImg,
  mode: MODE.LIGHT,
  layout: LAYOUT_OPTIONS.HYDROGEN,
};

export const metaObject = (
  title?: string,
  openGraph?: OpenGraph,
  description: string = siteConfig.description
): Metadata => {
  return {
    title: title ? `${title} - DrinksHarbour Admin` : siteConfig.title,
    description,
    openGraph: openGraph ?? {
      title: title ? `${title} - DrinksHarbour Admin` : title,
      description,
      siteName: 'DrinksHarbour',
      locale: 'en_US',
      type: 'website',
    },
  };
};
