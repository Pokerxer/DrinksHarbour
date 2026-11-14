'use client';

import React, { useEffect, useState } from 'react';
import * as Icon from 'react-icons/pi';
import { useAuthorization } from '@/hooks/use-authorization';
import { whatsappOrderService } from '@/services/whatsapp-order.service';
import { printOrderDocuments } from '@/utils/print/whatsapp-order-print';

/** Invoice block as serialized by GET /api/orders/:id (Mongoose subdoc). */
interface OrderInvoice {
  token?: string;
  issuedAt?: string | null;
  paymentReference?: string | null;
  attempt?: number;
}

export default function WhatsAppInvoicePanel({
  orderId,
  orderNumber,
  paymentStatus,
  invoice,
}: {
  orderId: string;
  orderNumber: string;
  paymentStatus: string;
  invoice: OrderInvoice | null | undefined;
}) {
  const { user } = useAuthorization();
  const token = user?.token || '';
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  // Customer link (token-gated hosted invoice). Built in an effect — never in
  // a state initializer — so `window` is untouched while this client component
  // is server-rendered and the first markup matches the server (no hydration
  // mismatch). After a live issue the fresh absolute URL replaces it.
  const [issued, setIssued] = useState<string | null>(null);

  useEffect(() => {
    if (!invoice?.token) {
      setIssued(null);
      return;
    }
    setIssued(
      new URL(`/invoice/${orderId}?token=${invoice.token}`, window.location.origin).toString()
    );
  }, [invoice?.token, orderId]);

  const issue = async (force: boolean) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = await whatsappOrderService.issueInvoice(token, orderId, force);
      setIssued(res.invoiceUrl);
      setMessage(
        res.resendOnly
          ? 'Invoice link re-sent to the customer.'
          : 'Invoice issued and sent via WhatsApp/email.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue the invoice');
    } finally {
      setBusy(false);
    }
  };

  const paid = paymentStatus === 'paid';

  return (
    <div
      id="whatsapp-invoice"
      className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden mb-5"
    >
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center justify-between">
        <h3 className="text-sm font-black text-gray-900 flex items-center gap-2">
          <Icon.PiWhatsappLogoBold size={16} className="text-green-600" /> WhatsApp invoice
        </h3>
        <span
          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            paid
              ? 'bg-green-100 text-green-700'
              : issued
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-500'
          }`}
        >
          {paid ? 'Paid' : issued ? `Unpaid · attempt ${invoice?.attempt ?? 1}` : 'Not issued'}
        </span>
      </div>
      <div className="p-5 space-y-3">
        {message && <p className="text-xs text-green-700">{message}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
        {issued && !paid && (
          <div className="text-xs text-gray-600 space-y-1">
            <p className="font-semibold">Customer link:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate bg-gray-50 border border-gray-100 rounded-lg px-2.5 py-1.5">
                {issued}
              </code>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(issued);
                  setMessage('Link copied.');
                }}
                className="text-[11px] font-bold text-red-700 hover:underline"
              >
                Copy
              </button>
              <a
                href={issued}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-bold text-red-700 hover:underline"
              >
                Open
              </a>
            </div>
            {invoice?.paymentReference && (
              <p className="text-gray-400">Charge reference: {invoice.paymentReference}</p>
            )}
          </div>
        )}
        {!paid && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => issue(false)}
              disabled={busy}
              className="px-4 py-2 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-xl text-xs font-bold disabled:opacity-50"
            >
              {busy ? 'Working…' : issued ? 'Re-send link' : 'Issue invoice'}
            </button>
            {issued && (
              <button
                type="button"
                onClick={() => issue(true)}
                disabled={busy}
                className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50 disabled:opacity-50"
              >
                Fresh charge (expired link)
              </button>
            )}
          </div>
        )}
        {/* Printable documents via the shared document-template pipeline. */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              printOrderDocuments(orderId, token, 'quotation').catch((e) =>
                setError(e instanceof Error ? e.message : 'Failed to build the quotation')
              )
            }
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50"
          >
            Print quotation
          </button>
          <button
            type="button"
            onClick={() =>
              printOrderDocuments(orderId, token, 'invoice').catch((e) =>
                setError(e instanceof Error ? e.message : 'Failed to build the invoice')
              )
            }
            className="px-4 py-2 border border-gray-200 text-gray-700 rounded-xl text-xs font-bold hover:bg-gray-50"
          >
            Print invoice
          </button>
        </div>
        {paid && (
          <p className="text-xs text-gray-500">
            Settled via {invoice?.paymentReference || 'gateway receipt'}.
          </p>
        )}
      </div>
    </div>
  );
}
