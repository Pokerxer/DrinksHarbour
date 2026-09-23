'use client';
import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Badge, Button, Loader, Text } from 'rizzui';
import toast from 'react-hot-toast';
import PageHeader from '@/app/shared/page-header';
import { routes } from '@/config/routes';
import { updateAdminTenant } from '@/services/tenant.service';
import { useTenantRecord } from '@/app/shared/ecommerce/tenant/use-tenant-record';
import { TenantDetailSections } from '@/app/shared/ecommerce/tenant/detail-sections';

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { tenant, loading, error, reload, token } = useTenantRecord(id);
  const [busy, setBusy] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejecting, setRejecting] = useState(false);
  async function changeStatus(status: string) {
    if (!token || busy) return;
    if (status === 'rejected' && !rejectionReason.trim()) { toast.error('Enter a rejection reason'); return; }
    if (['suspended', 'archived'].includes(status) && !window.confirm(`Set ${tenant?.name} to ${status}? This restricts access to the tenant.`)) return;
    setBusy(true);
    try {
      await updateAdminTenant(token, id, { status, ...(status === 'rejected' ? { rejectionReason: rejectionReason.trim() } : {}) });
      toast.success(`Tenant ${status}`);
      setRejecting(false);
      await reload();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Unable to update tenant'); }
    finally { setBusy(false); }
  }
  return <div className="min-w-0 space-y-5">
    <PageHeader title={tenant?.name || 'Tenant'} breadcrumb={[{ href: routes.eCommerce.tenants, name: 'Tenants' }, { name: tenant?.name || 'Details' }]}>
      {tenant && <Link href={routes.eCommerce.editTenant(id)}><Button className="mt-3">Edit tenant</Button></Link>}
    </PageHeader>
    {loading ? <div className="flex justify-center py-16"><Loader /></div> : error || !tenant ? <div role="alert" className="space-y-3"><Text>{error || 'Tenant not found'}</Text><Button onClick={() => void reload()}>Retry</Button></div> : <>
      <div className="flex min-w-0 flex-wrap items-center gap-4 rounded-xl border bg-white p-5">
        {tenant.logo?.url && <img src={tenant.logo.url} alt={`${tenant.name} logo`} className="h-16 w-16 rounded-xl object-contain" />}
        <div className="min-w-0 flex-1"><a className="break-all text-sm text-primary" href={`https://${tenant.slug}.drinksharbour.com`} target="_blank" rel="noopener noreferrer">{tenant.slug}.drinksharbour.com</a>
          <div className="mt-2 flex flex-wrap gap-2"><Badge variant="flat" color={tenant.status === 'approved' ? 'success' : 'warning'}>{tenant.status}</Badge><Badge variant="flat">{tenant.plan.replace(/_/g, ' ')}</Badge>{tenant.isSystemTenant && <Badge color="warning">System tenant</Badge>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {tenant.status !== 'approved' && <Button size="sm" disabled={busy} onClick={() => void changeStatus('approved')}>Approve</Button>}
          {tenant.status === 'pending' && <Button size="sm" variant="outline" disabled={busy} onClick={() => setRejecting(!rejecting)}>Reject</Button>}
          {tenant.status === 'approved' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus('suspended')}>Suspend</Button>}
          {tenant.status !== 'archived' && <Button size="sm" variant="outline" disabled={busy} onClick={() => void changeStatus('archived')}>Archive</Button>}
        </div>
      </div>
      {rejecting && <form className="space-y-3 rounded-xl border border-red-200 p-4" onSubmit={(event) => { event.preventDefault(); void changeStatus('rejected'); }}><label className="block text-sm">Reason for rejection<textarea required maxLength={1000} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className="mt-2 block w-full rounded-lg border p-3" /></label><Button type="submit" color="danger" isLoading={busy}>Reject tenant</Button></form>}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{[
        ['Products', tenant.productCount?.toLocaleString() ?? '—'], ['Orders', tenant.totalOrders?.toLocaleString() ?? '—'],
        ['Revenue (NGN)', tenant.totalRevenue == null ? '—' : new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(tenant.totalRevenue)],
      ].map(([label, value]) => <div key={label} className="min-w-0 rounded-xl border bg-white p-4"><p className="text-xs text-gray-500">{label}</p><p className="mt-1 break-words text-xl font-semibold">{value}</p></div>)}</div>
      <TenantDetailSections tenant={tenant} />
    </>}
  </div>;
}
