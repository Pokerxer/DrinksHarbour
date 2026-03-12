// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiFileBold, 
  PiCheckCircleBold, 
  PiClockBold,
  PiXBold,
  PiArrowRightBold,
  PiPencilBold,
  PiTrashBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Textarea, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { purchaseAgreementService, PurchaseAgreement } from '@/services/purchaseAgreement.service';

export default function PurchaseAgreementsPage() {
  const { data: session } = useSession();
  const [agreements, setAgreements] = useState<PurchaseAgreement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const fetchAgreements = async () => {
    if (!session?.user?.token) return;
    setIsLoading(true);
    try {
      const response = await purchaseAgreementService.getAgreements(session.user.token, {
        status: statusFilter || undefined,
        type: typeFilter || undefined,
        page,
        limit: 20,
      });
      if (response.success) {
        setAgreements(response.data);
        setTotalPages(response.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to fetch agreements:', error);
      toast.error('Failed to load agreements');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.token) {
      fetchAgreements();
    }
  }, [session?.user?.token, page, statusFilter, typeFilter]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700 border-gray-200',
      active: 'bg-green-100 text-green-700 border-green-200',
      expired: 'bg-red-100 text-red-700 border-red-200',
      exhausted: 'bg-orange-100 text-orange-700 border-orange-200',
      cancelled: 'bg-red-100 text-red-700 border-red-200',
    };
    return styles[status] || styles.draft;
  };

  const getTypeBadge = (type: string) => {
    return type === 'blanket_order' 
      ? 'bg-blue-100 text-blue-700 border-blue-200' 
      : 'bg-purple-100 text-purple-700 border-purple-200';
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this agreement?')) return;
    if (!session?.user?.token) return;
    
    try {
      const response = await purchaseAgreementService.deleteAgreement(id, session.user.token);
      if (response.success) {
        toast.success('Agreement deleted');
        fetchAgreements();
      } else {
        toast.error(response.message || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete agreement');
    }
  };

  return (
    <>
      <PageHeader
        title="Purchase Agreements"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { name: 'Agreements' },
        ]}
      >
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link href={routes.eCommerce.createPurchaseAgreement} className="w-full @lg:w-auto">
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              New Agreement
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 flex gap-4">
        <Select
          placeholder="Filter by Status"
          options={[
            { value: '', label: 'All Status' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'expired', label: 'Expired' },
            { value: 'exhausted', label: 'Exhausted' },
          ]}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-40"
        />
        <Select
          placeholder="Filter by Type"
          options={[
            { value: '', label: 'All Types' },
            { value: 'blanket_order', label: 'Blanket Order' },
            { value: 'call_for_tender', label: 'Call for Tender' },
          ]}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="w-48"
        />
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : agreements.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <PiFileBold className="h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No purchase agreements found</p>
            <Link href={routes.eCommerce.createPurchaseAgreement}>
              <Button className="mt-4">Create Your First Agreement</Button>
            </Link>
          </div>
        ) : (
          agreements.map((agreement) => (
            <div
              key={agreement._id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-gray-900">
                    {agreement.agreementNumber}
                  </h3>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getTypeBadge(agreement.agreementType)}`}>
                    {agreement.agreementType === 'blanket_order' ? 'Blanket Order' : 'Call for Tender'}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(agreement.status)}`}>
                    {agreement.status?.charAt(0).toUpperCase() + agreement.status?.slice(1)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={routes.eCommerce.purchaseAgreementDetails(agreement._id)}>
                    <Button variant="outline" size="sm">
                      View Details
                      <PiArrowRightBold className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Agreement Name</p>
                    <p className="mt-1 font-medium text-gray-900">{agreement.name}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Vendor</p>
                    <p className="mt-1 text-gray-900">{agreement.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Period</p>
                    <p className="mt-1 text-gray-900">
                      {agreement.startDate && new Date(agreement.startDate).toLocaleDateString()} - {agreement.endDate && new Date(agreement.endDate).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Consumption</p>
                    <p className="mt-1 text-gray-900">
                      {agreement.consumedQuantity || 0} / {agreement.totalQuantity || 0} units
                      <span className="ml-2 text-gray-500">
                        ({(agreement.consumedAmount || 0).toLocaleString('en-US', { style: 'currency', currency: agreement.currency || 'NGN' })} / {(agreement.totalAmount || 0).toLocaleString('en-US', { style: 'currency', currency: agreement.currency || 'NGN' })})
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </>
  );
}
