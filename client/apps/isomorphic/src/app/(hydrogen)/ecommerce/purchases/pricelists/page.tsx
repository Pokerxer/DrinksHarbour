// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiFileBold,
  PiPencilBold,
  PiTrashBold,
  PiArrowRightBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { vendorPricelistService, VendorPricelist } from '@/services/vendorPricelist.service';

export default function VendorPricelistsPage() {
  const { data: session } = useSession();
  const [pricelists, setPricelists] = useState<VendorPricelist[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [vendorFilter, setVendorFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState<boolean | null>(null);

  const fetchPricelists = async () => {
    if (!session?.user?.token) return;
    setIsLoading(true);
    try {
      const response = await vendorPricelistService.getPricelists(session.user.token, {
        vendor: vendorFilter || undefined,
        isActive: activeFilter ?? undefined,
        page,
        limit: 20,
      });
      if (response.success) {
        setPricelists(response.data);
        setTotalPages(response.pagination.pages);
      }
    } catch (error) {
      console.error('Failed to fetch pricelists:', error);
      toast.error('Failed to load pricelists');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.token) {
      fetchPricelists();
    }
  }, [session?.user?.token, page, vendorFilter, activeFilter]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricelist?')) return;
    if (!session?.user?.token) return;
    
    try {
      const response = await vendorPricelistService.deletePricelist(id, session.user.token);
      if (response.success) {
        toast.success('Pricelist deleted');
        fetchPricelists();
      } else {
        toast.error(response.message || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete pricelist');
    }
  };

  return (
    <>
      <PageHeader
        title="Vendor Pricelists"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { name: 'Vendor Pricelists' },
        ]}
      >
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link href={routes.eCommerce.createVendorPricelist} className="w-full @lg:w-auto">
            <Button as="span" className="w-full @lg:w-auto">
              <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
              New Pricelist
            </Button>
          </Link>
        </div>
      </PageHeader>

      <div className="mb-6 flex gap-4">
        <Input
          placeholder="Search by vendor..."
          value={vendorFilter}
          onChange={(e) => setVendorFilter(e.target.value)}
          className="w-64"
        />
        <Select
          placeholder="Filter by Status"
          options={[
            { value: '', label: 'All Status' },
            { value: 'true', label: 'Active' },
            { value: 'false', label: 'Inactive' },
          ]}
          value={activeFilter === null ? '' : String(activeFilter)}
          onChange={(e) => setActiveFilter(e.target.value === '' ? null : e.target.value === 'true')}
          className="w-40"
        />
      </div>

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : pricelists.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <PiFileBold className="h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No vendor pricelists found</p>
            <Link href={routes.eCommerce.createVendorPricelist}>
              <Button className="mt-4">Create Your First Pricelist</Button>
            </Link>
          </div>
        ) : (
          pricelists.map((pricelist) => (
            <div
              key={pricelist._id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
            >
              <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/50 px-6 py-4">
                <div className="flex items-center gap-4">
                  <h3 className="font-semibold text-gray-900">{pricelist.name}</h3>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                    pricelist.isActive 
                      ? 'bg-green-100 text-green-700 border-green-200' 
                      : 'bg-gray-100 text-gray-700 border-gray-200'
                  }`}>
                    {pricelist.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => handleDelete(pricelist._id)}
                  >
                    <PiTrashBold className="h-4 w-4 text-red-500" />
                  </Button>
                  <Link href={routes.eCommerce.vendorPricelistDetails(pricelist._id)}>
                    <Button variant="outline" size="sm">
                      View
                      <PiArrowRightBold className="ml-1 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
              
              <div className="px-6 py-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500">Vendor</p>
                    <p className="mt-1 font-medium text-gray-900">{pricelist.vendorName}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Currency</p>
                    <p className="mt-1 text-gray-900">{pricelist.currency}</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Items</p>
                    <p className="mt-1 text-gray-900">{pricelist.items?.length || 0} products</p>
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-500">Discount</p>
                    <p className="mt-1 text-gray-900">{pricelist.discountPercent || 0}%</p>
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
