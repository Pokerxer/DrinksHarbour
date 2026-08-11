import type { Metadata } from 'next';

/**
 * Metadata lives in a co-located layout, never in page.tsx.
 *
 * `page.tsx` here is a client component, and a client component cannot export
 * `metadata` at all — Next silently ignores it. This is the same arrangement
 * the platform app uses for every noindexed route.
 *
 * The noindex is the point. The URL IS the credential: a token in a search
 * result, a referrer header or a preview card is a copy of the pairing. It also
 * keeps one shop's counter screen out of results for the shop's own name.
 */
export const metadata: Metadata = {
  title: 'Staff clock',
  robots: { index: false, follow: false, nocache: true },
};

export default function KioskLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
