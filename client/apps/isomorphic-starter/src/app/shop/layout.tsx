// Metadata is handled dynamically in page.tsx via generateMetadata (reads searchParams).
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
