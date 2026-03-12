// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiArrowLeftBold,
  PiCheckBold,
  PiXBold,
  PiPencilBold,
  PiTrashBold,
  PiPlusBold,
  PiFileBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Textarea, Badge } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { purchaseAgreementService, PurchaseAgreement } from '@/services/purchaseAgreement.service';

export default function PurchaseAgreementDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { data: session } = useSession();
  
  const [agreement, setAgreement] = useState<PurchaseAgreement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActionLoading, setIsActionLoading] = useState(false);

  useEffect(() => {
    const fetchAgreement = async () => {
      if (!session?.user?.token || !params.id) return;
      setIsLoading(true);
      try {
        const response = await purchaseAgreementService.getAgreement(params.id, session.user.token);
        if (response.success) {
          setAgreement(response.data);
        } else {
          toast.error('Failed to load agreement');
          router.push(routes.eCommerce.purchaseAgreements);
        }
      } catch (error) {
        console.error('Failed to fetch agreement:', error);
        toast.error('Failed to load agreement');
      } finally {
        setIsLoading(false);
      }
    };

    fetchAgreement();
  }, [session?.user?.token, params.id, router]);

  const handleActivate = async () => {
    if (!session?.user?.token || !params.id) return;
    setIsActionLoading(true);
    try {
      const response = await purchaseAgreementService.activateAgreement(params.id, session.user.token);
      if (response.success) {
        toast.success('Agreement activated');
        setAgreement(response.data);
      } else {
        toast.error(response.message || 'Failed to activate');
      }
    } catch (error) {
      toast.error('Failed to activate agreement');
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCreatePO = async () => {
    if (!agreement || !session?.user?.token) return;
    
    const itemsToOrder = agreement.items.map(item => ({
      subProductId: item.subProductId,
      subProductName: item.subProductName,
      quantity: Math.min(item.quantity - (item.consumedQuantity || 0), item.quantity),
      unitPrice: item.unitPrice,
    })).filter(item => item.quantity > 0);

    if (itemsToOrder.length === 0) {
      toast.error('No remaining quantity to order');
      return;
    }

    setIsActionLoading(true);
    try {
      const response = await purchaseAgreementService.createPOFromAgreement(
        agreement._id,
        { items: itemsToOrder },
        session.user.token
      );
      if (response.success) {
        toast.success('Purchase Order created');
        router.push(routes.eCommerce.purchaseDetails(response.data._id));
      } else {
        toast.error(response.message || 'Failed to create PO');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create PO');
    } finally {
      setIsActionLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      active: 'bg-green-100 text-green-700',
      expired: 'bg-red-100 text-red-700',
      exhausted: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    return styles[status] || styles.draft;
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
      </div>
    );
  }

  if (!agreement) {
    return null;
  }

  const consumedPercent = agreement.totalQuantity > 0 
    ? ((agreement.consumedQuantity || 0) / agreement.totalQuantity) * 100 
    : 0;

  return (
    <>
      <PageHeader
        title={`Agreement: ${agreement.agreementNumber}`}
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { href: routes.eCommerce.purchaseAgreements, name: 'Agreements' },
          { name: agreement.agreementNumber },
        ]}
      >
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Link href={routes.eCommerce.purchaseAgreements}>
            <Button variant="outline">
              <PiArrowLeftBold className="mr-1 h-4 w-4" />
              Back
            </Button>
          </Link>
          {agreement.status === 'draft' && (
            <Button onClick={handleActivate} isLoading={isActionLoading}>
              <PiCheckBold className="mr-1 h-4 w-4" />
              Activate Agreement
            </Button>
          )}
          {agreement.status === 'active' && (
            <Button onClick={handleCreatePO} isLoading={isActionLoading}>
              <PiPlusBold className="mr-1 h-4 w-4" />
              Create Purchase Order
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Agreement Information</h3>
              <Badge variant="flat" color={agreement.status === 'active' ? 'success' : 'secondary'}>
                {agreement.status?.toUpperCase()}
              </Badge>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Agreement Number</p>
                <p className="font-medium">{agreement.agreementNumber}</p>
              </div>
              <div>
                <p className="text-gray-500">Type</p>
                <p className="font-medium">
                  {agreement.agreementType === 'blanket_order' ? 'Blanket Order' : 'Call for Tender'}
                </p>
              </div>
              <div>
                <p className="text-gray-500">Vendor</p>
                <p className="font-medium">{agreement.vendorName}</p>
              </div>
              <div>
                <p className="text-gray-500">Currency</p>
                <p className="font-medium">{agreement.currency}</p>
              </div>
              <div>
                <p className="text-gray-500">Start Date</p>
                <p className="font-medium">
                  {agreement.startDate && new Date(agreement.startDate).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500">End Date</p>
                <p className="font-medium">
                  {agreement.endDate && new Date(agreement.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Items</h3>
            {agreement.items?.length === 0 ? (
              <div className="flex h-24 items-center justify-center text-gray-500">
                No items in this agreement
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-2 text-left font-medium text-gray-600">Product</th>
                      <th className="pb-2 text-left font-medium text-gray-600">Size</th>
                      <th className="pb-2 text-right font-medium text-gray-600">Quantity</th>
                      <th className="pb-2 text-right font-medium text-gray-600">Consumed</th>
                      <th className="pb-2 text-right font-medium text-gray-600">Unit Price</th>
                      <th className="pb-2 text-right font-medium text-gray-600">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agreement.items?.map((item, index) => (
                      <tr key={index} className="border-b border-gray-50">
                        <td className="py-2">
                          <p className="font-medium">{item.subProductName}</p>
                          <p className="text-xs text-gray-500">{item.sku}</p>
                        </td>
                        <td className="py-2">{item.sizeName || '-'}</td>
                        <td className="py-2 text-right">{item.quantity}</td>
                        <td className="py-2 text-right">{item.consumedQuantity || 0}</td>
                        <td className="py-2 text-right">
                          {agreement.currency} {item.unitPrice.toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          {agreement.currency} {(item.quantity * item.unitPrice).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="font-semibold">
                      <td className="pt-2" colSpan={2}>Total</td>
                      <td className="pt-2 text-right">{agreement.totalQuantity}</td>
                      <td className="pt-2 text-right">{agreement.consumedQuantity}</td>
                      <td className="pt-2 text-right"></td>
                      <td className="pt-2 text-right">
                        {agreement.currency} {agreement.totalAmount?.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {agreement.termsConditions && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold">Terms & Conditions</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{agreement.termsConditions}</p>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold">Consumption</h3>
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="font-medium">{consumedPercent.toFixed(1)}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div 
                className="h-full bg-blue-600 transition-all"
                style={{ width: `${Math.min(consumedPercent, 100)}%` }}
              />
            </div>
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Total Quantity</span>
                <span className="font-medium">{agreement.totalQuantity?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Consumed</span>
                <span className="font-medium">{(agreement.consumedQuantity || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Remaining</span>
                <span className="font-medium">{((agreement.totalQuantity || 0) - (agreement.consumedQuantity || 0)).toLocaleString()}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-medium">{agreement.currency} {agreement.totalAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Consumed</span>
                  <span className="font-medium">{agreement.currency} {(agreement.consumedAmount || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Remaining</span>
                  <span className="font-medium">{agreement.currency} {((agreement.totalAmount || 0) - (agreement.consumedAmount || 0)).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>

          {agreement.agreementType === 'call_for_tender' && agreement.tenderResponses && agreement.tenderResponses.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold">Tender Responses</h3>
              <div className="space-y-3">
                {agreement.tenderResponses.map((response, index) => (
                  <div key={index} className="rounded-lg border border-gray-100 bg-gray-50 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{response.vendorName}</p>
                      <Badge 
                        variant="flat" 
                        color={response.status === 'accepted' ? 'success' : response.status === 'rejected' ? 'danger' : 'secondary'}
                      >
                        {response.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600">
                      {agreement.currency} {response.totalAmount?.toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {agreement.purchaseOrders && agreement.purchaseOrders.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-lg font-semibold">Related POs</h3>
              <div className="space-y-2">
                {agreement.purchaseOrders.map((poId: string) => (
                  <Link 
                    key={poId} 
                    href={routes.eCommerce.purchaseDetails(poId)}
                    className="block rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm hover:bg-gray-100"
                  >
                    PO #{poId.slice(-8)}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
