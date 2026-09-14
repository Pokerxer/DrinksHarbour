import { redirect } from 'next/navigation';

export default async function POSSessionsRedirect({ searchParams }: { searchParams: Promise<{ shopId?: string }> }) {
  const { shopId } = await searchParams;
  redirect(shopId === 'legacy' ? '/pos/sessions?shopId=legacy' : '/pos/sessions');
}
