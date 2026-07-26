// @ts-nocheck
import EcommerceDashboard from '@/app/shared/ecommerce/dashboard';
import { metaObject } from '@/config/site.config';

export const metadata = {
  ...metaObject('E-Commerce'),
};

export default function eCommerceDashboardPage({
  searchParams,
}: {
  searchParams?: { period?: string; from?: string; to?: string };
}) {
  return <EcommerceDashboard searchParams={searchParams} />;
}
