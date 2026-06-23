import { metaObject } from '@/config/site.config';
import { resolveTenant } from '@/app/auth/_lib/resolve-tenant';
import BrandAuthLayout from '@/app/auth/_components/brand-auth-layout';
import ForgetPasswordForm from './forget-password-form';

export const metadata = {
  ...metaObject('Forgot Password'),
};

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<{ _tenant?: string }>;
}) {
  const params = await searchParams;
  const tenant = await resolveTenant(params._tenant);

  return (
    <BrandAuthLayout
      tenant={tenant}
      headline="Forgot your password? It happens."
      subcopy="Enter your email and we'll send you a secure link to set a new one."
    >
      <ForgetPasswordForm tenant={tenant} />
    </BrandAuthLayout>
  );
}
