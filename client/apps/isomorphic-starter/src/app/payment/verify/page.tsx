'use client';

export const dynamic = 'force-dynamic';

import React, { useEffect, useRef, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { API_URL } from '@/lib/api';
import { useCart } from '@/context/CartContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type Stage = 'verifying' | 'creating' | 'success' | 'error';

// ─── Main content (needs Suspense for useSearchParams) ───────────────────────

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { clearCart } = useCart();

  // Paystack sends both `reference` and `trxref` — use either
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const [stage, setStage] = useState<Stage>('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const processedRef = useRef(false); // prevent double-run in strict mode / refresh

  useEffect(() => {
    if (!reference) {
      setStage('error');
      setErrorMessage('No payment reference found in the URL.');
      return;
    }
    if (processedRef.current) return;
    processedRef.current = true;

    runVerification(reference);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);

  async function runVerification(ref: string) {
    try {
      const token =
        localStorage.getItem('token') || sessionStorage.getItem('token');

      // ── Idempotency: if this reference was already processed, go straight to
      //    the confirmation page without creating a duplicate order.
      const alreadyDone = localStorage.getItem(`ps_done_${ref}`);
      if (alreadyDone) {
        router.replace(`/order-confirmation?orderId=${alreadyDone}`);
        return;
      }

      // ── Step 1: Verify the payment with the server ───────────────────────
      setStage('verifying');
      const verifyRes = await fetch(
        `${API_URL}/api/payments/paystack/verify/${ref}`,
        {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        },
      );
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.success) {
        throw new Error(verifyData.message || 'Payment verification failed.');
      }

      const paymentInfo = verifyData.data; // { reference, transactionId, amount, paidAt, channel }

      // ── Step 2: Read the pending order data ──────────────────────────────
      const pendingRaw =
        localStorage.getItem('pendingPayment') ||
        sessionStorage.getItem('pendingPayment');

      if (!pendingRaw) {
        throw new Error(
          `Your payment was received (ref: ${ref}), but the order data was not found. ` +
          `Please contact support with this reference number.`,
        );
      }

      const pending = JSON.parse(pendingRaw) as {
        reference: string;
        formData: {
          customer: {
            firstName: string;
            lastName: string;
            email: string;
            phone: string;
          };
          shipping: {
            address: string;
            city: string;
            state: string;
            zipCode: string;
            country: string;
            coordinates?: { latitude: number; longitude: number };
          };
        };
        cartItems: any[];
        subtotal: number;
        shippingFee: number;
        total: number;
        couponCode?: string;
      };

      // ── Step 3: Create the order ─────────────────────────────────────────
      setStage('creating');

      const orderData = {
        customer: {
          firstName: pending.formData.customer.firstName,
          lastName: pending.formData.customer.lastName,
          email: pending.formData.customer.email,
          phone: pending.formData.customer.phone,
        },
        shipping: {
          address: pending.formData.shipping.address,
          city: pending.formData.shipping.city,
          state: pending.formData.shipping.state,
          zipCode: pending.formData.shipping.zipCode,
          country: pending.formData.shipping.country,
          coordinates: pending.formData.shipping.coordinates,
        },
        paymentMethod: 'bank_transfer',
        paymentDetails: {
          method: 'paystack',
          transactionId: paymentInfo.reference || ref,
          paystackTransactionId: paymentInfo.transactionId,
          status: 'paid',
          paidAt: paymentInfo.paidAt || new Date().toISOString(),
          channel: paymentInfo.channel,
          amount: paymentInfo.amount,
        },
        items: pending.cartItems.map((item: any) => ({
          productId: item.selectedProductId || item.id || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          sizeId: item.selectedSizeId || null,
          subProductId: item.selectedSubProductId || null,
          tenantId: item.selectedVendorId || null,
        })),
        subtotal: pending.subtotal,
        shippingFee: pending.shippingFee,
        total: pending.total,
        couponCode: pending.couponCode || undefined,
        status: 'processing',
        paymentStatus: 'paid',
      };

      const orderRes = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(orderData),
      });

      const orderResult = await orderRes.json();

      if (!orderRes.ok) {
        throw new Error(orderResult.message || 'Failed to create order after payment.');
      }

      const orderId =
        orderResult.data?.order?._id ||
        orderResult.data?.order?.id ||
        orderResult.order?._id ||
        orderResult.order?.id;

      // ── Step 4: Clean up ─────────────────────────────────────────────────
      localStorage.removeItem('pendingPayment');
      sessionStorage.removeItem('pendingPayment');
      localStorage.removeItem('appliedCoupon');
      localStorage.setItem('customerEmail', pending.formData.customer.email);
      // Mark as done so a refresh doesn't re-create the order
      if (orderId) localStorage.setItem(`ps_done_${ref}`, orderId);

      clearCart();
      setStage('success');

      router.replace(`/order-confirmation?orderId=${orderId}`);
    } catch (err: any) {
      console.error('Payment verification error:', err);
      setStage('error');
      setErrorMessage(err.message || 'An unexpected error occurred.');
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (stage === 'verifying' || stage === 'creating' || stage === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white px-4">
        <div className="text-center max-w-sm">
          <div className="relative w-20 h-20 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full bg-green-100 animate-pulse" />
            <div className="relative w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
              {stage === 'success' ? (
                <Icon.PiCheckCircle size={40} className="text-white" />
              ) : (
                <div className="w-8 h-8 border-4 border-white/40 border-t-white rounded-full animate-spin" />
              )}
            </div>
          </div>

          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {stage === 'verifying' && 'Verifying Payment…'}
            {stage === 'creating' && 'Confirming Order…'}
            {stage === 'success' && 'Payment Successful!'}
          </h2>
          <p className="text-gray-500 text-sm">
            {stage === 'verifying' && 'Confirming your payment with Paystack. Please wait.'}
            {stage === 'creating' && 'Creating your order. Please do not close this page.'}
            {stage === 'success' && 'Redirecting to your order confirmation…'}
          </p>

          {reference && (
            <p className="mt-4 text-xs text-gray-400">
              Reference: <span className="font-mono">{reference}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-red-50 to-white px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <Icon.PiWarningCircle size={40} className="text-red-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-3">Payment Issue</h2>
        <p className="text-gray-600 mb-2 text-sm leading-relaxed">{errorMessage}</p>
        {reference && (
          <p className="text-xs text-gray-400 mb-6">
            Reference: <span className="font-mono bg-gray-100 px-2 py-0.5 rounded">{reference}</span>
          </p>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => {
              processedRef.current = false;
              setStage('verifying');
              setErrorMessage('');
              if (reference) runVerification(reference);
            }}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-br from-red-700 to-red-900 text-white rounded-lg font-semibold hover:from-red-800 hover:to-red-950 transition-all shadow-md text-sm"
          >
            <Icon.PiArrowClockwise size={18} />
            Try Again
          </button>
          <a
            href="/shop"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-700 rounded-lg font-semibold hover:border-gray-400 transition-colors text-sm"
          >
            <Icon.PiArrowLeft size={18} />
            Back to Shop
          </a>
        </div>
        <p className="mt-6 text-xs text-gray-400">
          If money was deducted, please contact{' '}
          <a href="/contact" className="underline">support</a>{' '}
          with your reference number.
        </p>
      </div>
    </div>
  );
}

// ─── Page export with Suspense (required for useSearchParams) ────────────────

export default function PaymentVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-green-50 to-white">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-green-100 border-t-green-500 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-500 text-sm">Loading…</p>
          </div>
        </div>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
