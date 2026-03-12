'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { PiPrinter, PiDownload, PiArrowLeft } from 'react-icons/pi';
import { useReactToPrint } from 'react-to-print';
import { Button } from 'rizzui';
import { purchaseOrderService } from '@/services/purchaseOrder.service';

const CURRENCY_SYMBOLS: Record<string, string> = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
};

function formatCurrency(amount: number, currency: string = 'NGN'): string {
  const symbol = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(date: Date | string | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatAddress(address: any): string {
  if (!address) return '';
  const parts = [
    address.street,
    address.city,
    address.state,
    address.zipCode,
    address.country
  ].filter(part => part);
  return parts.join(', ');
}

export default function PurchaseOrderReceiptPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();
  const { data: session } = useSession();
  const [receiptData, setReceiptData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReceipt = async () => {
      if (!session?.user?.token || !id) return;

      try {
        setLoading(true);
        const response =
          await purchaseOrderService.generatePurchaseOrderReceipt(
            id,
            session.user.token
          );

        if (response.success) {
          console.log('Receipt data received:', response.data);
          setReceiptData(response.data);
        } else {
          setError(response.message || 'Failed to load receipt');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load receipt');
      } finally {
        setLoading(false);
      }
    };

    fetchReceipt();
  }, [session, id]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: receiptData?.purchaseOrder?.poNumber
      ? `PO-${receiptData.purchaseOrder.poNumber}`
      : 'Purchase-Order',
  });

  const onPrint = () => {
    handlePrint?.();
  };

  const onDownload = () => {
    handlePrint?.();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-blue-500 border-t-transparent"></div>
          <p className="text-gray-600">Loading receipt...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md text-center">
          <h2 className="mb-2 text-xl font-bold text-red-600">
            Error Loading Receipt
          </h2>
          <p className="mb-6 text-gray-600">{error}</p>
          <Button onClick={() => router.back()} variant="outline">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!receiptData) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900">Receipt Not Found</h2>
          <p className="mt-2 text-gray-600">
            The requested receipt could not be found.
          </p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  const currency = receiptData.purchaseOrder?.currency || 'NGN';
  const brandColor = receiptData.tenant?.primaryColor || '#1e3a8a'; // Default to Navy Blue

  return (
    <div className="min-h-screen bg-gray-50 print:bg-white">
      {/* Header - Hidden when printing */}
      <div className="print:hidden">
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center justify-between">
            <Button
              variant="text"
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <PiArrowLeft className="h-4 w-4" />
              Back to Purchase Order
            </Button>
            <div className="flex gap-3">
              <Button onClick={onPrint} className="flex items-center gap-2">
                <PiPrinter className="h-4 w-4" />
                Print
              </Button>
              <Button
                variant="outline"
                onClick={onDownload}
                className="flex items-center gap-2"
              >
                <PiDownload className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Content */}
      <div
        ref={printRef}
        className="mx-auto max-w-4xl px-4 py-6 sm:px-6 print:px-0 print:py-0"
      >
        <div className="bg-white shadow-lg print:shadow-none rounded-xl print:rounded-none overflow-hidden">
          {/* Top Color Bar */}
          <div style={{ backgroundColor: brandColor }} className="h-4 w-full print:h-4"></div>

          {/* Letterhead */}
          <div className="p-8 pb-6 print:p-6 print:pb-4">
            <div className="flex justify-between items-start">
              <div className="w-1/2">
                {receiptData.tenant?.logo?.url ? (
                  <img 
                    src={receiptData.tenant.logo.url} 
                    alt={receiptData.tenant.name}
                    className="h-16 w-auto object-contain mb-3"
                  />
                ) : (
                  <h1 style={{ color: brandColor }} className="text-3xl font-bold uppercase tracking-tight mb-2">
                    {receiptData.tenant?.name || 'COMPANY NAME'}
                  </h1>
                )}
                <div className="text-sm text-gray-600 leading-relaxed">
                  {receiptData.tenant?.address && (
                    <p className="font-medium">{formatAddress(receiptData.tenant.address)}</p>
                  )}
                  <div className="flex flex-col mt-1 gap-1">
                    {receiptData.tenant?.phone && (
                      <p>Tel: {receiptData.tenant.phone}</p>
                    )}
                    {receiptData.tenant?.email && (
                      <p>Email: {receiptData.tenant.email}</p>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right w-1/2">
                <h2 style={{ color: brandColor }} className="text-4xl font-extrabold uppercase tracking-tight">PURCHASE ORDER</h2>
                <div className="mt-2 inline-block text-left">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
                    <span className="text-gray-500 font-medium text-right">PO Number:</span>
                    <span className="font-bold text-gray-900">#{receiptData.purchaseOrder?.poNumber}</span>
                    
                    <span className="text-gray-500 font-medium text-right">Date:</span>
                    <span className="font-bold text-gray-900">{formatDate(receiptData.purchaseOrder?.orderDate || receiptData.purchaseOrder?.confirmationDate || new Date())}</span>
                    
                    <span className="text-gray-500 font-medium text-right">Status:</span>
                    <span className="font-bold capitalize px-2 py-0.5 rounded text-xs inline-block bg-gray-100 text-gray-800 w-fit">
                      {receiptData.purchaseOrder?.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 mx-8 print:mx-6" />

          {/* Vendor & Ship To Grid */}
          <div className="p-8 py-6 print:p-6 print:py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 print:gap-8">
              {/* Vendor */}
              <div>
                <h3 style={{ color: brandColor }} className="text-xs font-bold uppercase tracking-wider mb-3 border-b pb-1">
                  Vendor Information
                </h3>
                <div className="text-sm">
                  <p className="font-bold text-lg text-gray-900 mb-1">{receiptData.vendor?.name || 'N/A'}</p>
                  <div className="text-gray-600 space-y-1">
                    {receiptData.vendor?.address ? (
                      <p>{formatAddress(receiptData.vendor.address)}</p>
                    ) : (
                      <p className="italic text-gray-400">No address provided</p>
                    )}
                    {receiptData.vendor?.phone && <p>Tel: {receiptData.vendor.phone}</p>}
                    {receiptData.vendor?.email && <p>Email: {receiptData.vendor.email}</p>}
                  </div>
                </div>
              </div>
              
              {/* Ship To */}
              <div>
                <h3 style={{ color: brandColor }} className="text-xs font-bold uppercase tracking-wider mb-3 border-b pb-1">
                  Shipping Information
                </h3>
                <div className="text-sm">
                  <p className="font-bold text-lg text-gray-900 mb-1">{receiptData.tenant?.name || 'N/A'}</p>
                  <div className="text-gray-600 space-y-1">
                    {receiptData.tenant?.address ? (
                      <p>{formatAddress(receiptData.tenant.address)}</p>
                    ) : (
                      <p className="italic text-gray-400">Same as company address</p>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 bg-gray-50 p-3 rounded-lg border border-gray-100 print:bg-transparent print:border-0 print:p-0">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Expected Arrival</p>
                    <p className="font-medium text-gray-900">{formatDate(receiptData.purchaseOrder?.expectedArrival)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Payment Terms</p>
                    <p className="font-medium text-gray-900">{receiptData.purchaseOrder?.paymentTerms || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Buyer</p>
                    <p className="font-medium text-gray-900">{receiptData.createdBy?.name || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Order Date</p>
                    <p className="font-medium text-gray-900">{formatDate(receiptData.purchaseOrder?.orderDate)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="px-8 print:px-6">
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead style={{ backgroundColor: brandColor }} className="text-white print:text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider border-r border-white/20">
                      Item & Description
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider border-r border-white/20 w-20">
                      Qty
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-white/20 w-32">
                      Unit Price
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-white/20 w-24">
                      Disc.
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider border-r border-white/20 w-24">
                      Tax
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wider w-36">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {receiptData.items?.map((item: any, index: number) => {
                    const qty = item.quantity || 0;
                    const unitPrice = item.unitCost || 0;
                    const discount = item.discount || 0;
                    const taxRate = item.taxRate || 0;
                    const totalCost = item.totalCost || 0;
                    const isNegative = qty < 0;

                    return (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50 print:bg-gray-50'}>
                        <td className="px-4 py-3 text-sm border-r border-gray-200">
                          <div className="font-semibold text-gray-900">{item.subProductName}</div>
                          {item.sizeName && (
                            <div className="text-xs text-gray-500 mt-0.5">
                              Size: {item.sizeName}
                            </div>
                          )}
                          <div className="text-xs text-gray-500">
                            {qty} {item.uom || 'Units'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm border-r border-gray-200 font-medium text-gray-700">
                          {qty}
                        </td>
                        <td className="px-4 py-3 text-right text-sm border-r border-gray-200 text-gray-700">
                          {formatCurrency(unitPrice, currency)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm border-r border-gray-200 text-gray-600">
                          {discount !== 0
                            ? `${discount > 0 ? '' : '-'}${Math.abs(discount).toFixed(2)}%`
                            : '-'}
                        </td>
                        <td className="px-4 py-3 text-right text-sm border-r border-gray-200 text-gray-600">
                          {taxRate !== 0 ? `${taxRate.toFixed(2)}%` : '-'}
                        </td>
                        <td className={`px-4 py-3 text-right text-sm font-bold ${isNegative ? 'text-red-600' : 'text-gray-900'}`}>
                          {formatCurrency(totalCost, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Notes and Totals */}
          <div className="p-8 print:p-6 grid grid-cols-1 md:grid-cols-12 gap-8">
            <div className="md:col-span-7 space-y-6">
              {/* Bank Details */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 print:bg-transparent print:border-gray-300">
                <h3 style={{ color: brandColor }} className="text-xs font-bold uppercase tracking-wider mb-2">
                  Payment Information
                </h3>
                <div className="text-sm text-gray-700 grid grid-cols-2 gap-2">
                  {receiptData.vendor?.bankDetails?.bankName ? (
                    <>
                      <div>
                        <span className="block text-xs text-gray-500">Bank Name</span>
                        <span className="font-medium">{receiptData.vendor.bankDetails.bankName}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-gray-500">Account Number</span>
                        <span className="font-medium font-mono">{receiptData.vendor.bankDetails.accountNumber}</span>
                      </div>
                      {receiptData.vendor.bankDetails.accountName && (
                        <div className="col-span-2">
                          <span className="block text-xs text-gray-500">Account Name</span>
                          <span className="font-medium">{receiptData.vendor.bankDetails.accountName}</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-gray-500 italic col-span-2">Bank details not provided by vendor.</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <h3 style={{ color: brandColor }} className="text-xs font-bold uppercase tracking-wider mb-1">
                  Notes / Terms
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {receiptData.purchaseOrder?.notes || 'No special instructions. Please include PO number on all invoices and shipping documents.'}
                </p>
                <p className="mt-2 text-xs font-bold text-gray-500 uppercase">
                  No Return Of Drinks
                </p>
              </div>
            </div>
            
            {/* Totals Section */}
            <div className="md:col-span-5">
              <div className="bg-gray-50 rounded-lg p-5 border border-gray-200 print:bg-transparent print:border-gray-300">
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">Subtotal</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(receiptData.totals?.totalCost || 0, currency)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-medium">Tax / VAT</span>
                    <span className="font-bold text-gray-900">
                      {formatCurrency(receiptData.totals?.taxTotal || 0, currency)}
                    </span>
                  </div>
                  <div className="h-px bg-gray-300 my-2"></div>
                  <div className="flex justify-between items-center">
                    <span style={{ color: brandColor }} className="text-lg font-extrabold uppercase">Total</span>
                    <span style={{ color: brandColor }} className="text-2xl font-extrabold">
                      {formatCurrency(
                        (receiptData.totals?.totalCost || 0) +
                          (receiptData.totals?.taxTotal || 0),
                        currency
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div style={{ backgroundColor: brandColor }} className="mt-4 px-8 py-3 text-center text-white print:px-6">
            <p className="text-xs opacity-90 font-medium">
              {receiptData.tenant?.name} &bull; {receiptData.tenant?.address?.city || 'Abuja'} &bull; {receiptData.tenant?.address?.country || 'Nigeria'}
            </p>
            <p className="text-[10px] opacity-70 mt-1">
              This is a computer-generated document and does not require a signature. &bull; Page 1 of 1
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}