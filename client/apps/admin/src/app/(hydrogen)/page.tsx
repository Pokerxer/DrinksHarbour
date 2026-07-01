import { redirect } from 'next/navigation';
import { routes } from '@/config/routes';

export const dynamic = 'force-dynamic';

export default function RootIndexPage() {
  redirect(routes.eCommerce.dashboard);
}