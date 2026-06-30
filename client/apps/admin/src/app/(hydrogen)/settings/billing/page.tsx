import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getErmPlans, getErmStatus } from '@/services/erm.service';
import BillingPage from '@/app/shared/erm/billing-page';
import { TENANT_ROLES } from '@/types/authorization';

export const metadata = { title: 'Subscription & Billing' };

export default async function BillingSettingsPage() {
  const user = await getAuthenticatedUser();

  if (!user?.token || !TENANT_ROLES.includes(user.role as any)) {
    redirect('/');
  }

  const [plans, status] = await Promise.all([
    getErmPlans(),
    getErmStatus(user.token as string),
  ]);

  if (!status) redirect('/');

  return (
    <div className="px-4 py-6 @container md:px-6 lg:px-8">
      <BillingPage plans={plans} status={status} token={user.token as string} />
    </div>
  );
}
