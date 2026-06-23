import { metaObject } from '@/config/site.config';
import { resolveTenant } from '@/app/auth/_lib/resolve-tenant';
import BrandAuthLayout from '@/app/auth/_components/brand-auth-layout';
import ResetPasswordForm from './reset-password-form';

export const metadata = {
  ...metaObject('Reset Password'),
};

export default async function ResetPassword({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ _tenant?: string }>;
}) {
  const [{ token }, query] = await Promise.all([params, searchParams]);
  const tenant = await resolveTenant(query._tenant);

  return (
    <BrandAuthLayout
      tenant={tenant}
      headline="Set a new password."
      subcopy="Choose a strong password you don't use anywhere else and you'll be back in."
    >
      <ResetPasswordForm token={token} tenant={tenant} />
    </BrandAuthLayout>
  );
}
