import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Print' };

export default function PrintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
