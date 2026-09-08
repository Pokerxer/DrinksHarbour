import { redirect } from 'next/navigation';
import { getAuthenticatedUser } from '@/lib/server-auth';
import { getErmPlans, getErmStatus } from '@/services/erm.service';
import BillingPage from '@/app/shared/erm/billing-page';
import { TENANT_ROLES } from '@/types/authorization';

export const metadata = { title: 'Subscription & Billing' };

export default async function BillingSettingsPage() {
  const user = await getAuthenticatedUser();

  if (!user?.token || !TENANT_ROLES.includes(user.role)) {
    redirect('/');
  }

  const [plans, status] = await Promise.all([
    getErmPlans(),
    getErmStatus(user.token as string),
  ]);

  if (!status)
    return (
      <div className="p-6" role="alert">
        <h1 className="text-xl font-semibold">
          Billing is temporarily unavailable
        </h1>
        <p className="mt-2">
          We could not load your subscription. Your plan has not been changed.
        </p>
        <a className="mt-4 inline-block underline" href="/settings/billing">
          Try again
        </a>
      </div>
    );

  return (
    <div className="@container">
      <BillingPage plans={plans} status={status} token={user.token as string} />
    </div>
  );
}
