'use client';
import { useParams } from 'next/navigation';
import { Button, Loader, Text } from 'rizzui';
import CreateTenant from '@/app/shared/ecommerce/tenant/create-tenant';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import { useTenantRecord } from '@/app/shared/ecommerce/tenant/use-tenant-record';
import { tenantFormValues } from '@/app/shared/ecommerce/tenant/tenant-form-values';

export default function EditTenantPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant, loading, error, reload } = useTenantRecord(id);
  return <>
    <PageHeader title={tenant ? `Edit: ${tenant.name}` : 'Edit tenant'} breadcrumb={[{ href: routes.eCommerce.tenants, name: 'Tenants' }, { href: routes.eCommerce.tenantDetails(id), name: tenant?.name || 'Tenant' }, { name: 'Edit' }]} />
    {loading ? <div className="flex justify-center py-16"><Loader /></div> : error || !tenant ? <div role="alert" className="space-y-3"><Text>{error || 'Tenant not found'}</Text><Button onClick={() => void reload()}>Retry</Button></div> : <CreateTenant key={tenant._id} id={id} tenant={tenantFormValues(tenant)} currentLogoUrl={tenant.logo?.url} meta={{ ...tenant, owner: typeof tenant.admin === 'object' ? tenant.admin : null }} isModalView={false} />}
  </>;
}
