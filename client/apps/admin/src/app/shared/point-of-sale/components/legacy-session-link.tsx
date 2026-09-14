import Link from 'next/link';

export function LegacySessionLink({ error }: { error: string }) {
  if (!error.includes('unassigned legacy session')) return null;
  return (
    <Link href="/pos/sessions?shopId=legacy" className="mx-3 text-sm font-semibold underline">
      Review and close legacy session
    </Link>
  );
}
