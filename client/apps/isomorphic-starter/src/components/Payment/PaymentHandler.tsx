'use client';

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script';
import * as Icon from 'react-icons/pi';

declare global {
  interface Window {
    Stripe?: (key: string) => any;
  }
}

interface PaymentHandlerProps {
  clientSecret: string;
  amount: number;
  onPaymentSuccess: (data: any) => Promise<void>;
  onPaymentError: (error: string) => void;
}

const STRIPE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';

const PaymentHandler: React.FC<PaymentHandlerProps> = ({
  clientSecret,
  amount,
  onPaymentSuccess,
  onPaymentError,
}) => {
  const cardRef     = useRef<HTMLDivElement>(null);
  const stripeRef   = useRef<any>(null);
  const elementRef  = useRef<any>(null);

  const [scriptLoaded, setScriptLoaded] = useState(false);
  const [cardReady,    setCardReady]    = useState(false);
  const [processing,   setProcessing]   = useState(false);
  const [cardError,    setCardError]    = useState('');
  const [cardComplete, setCardComplete] = useState(false);

  // Mount card element once Stripe.js is loaded
  useEffect(() => {
    if (!scriptLoaded || !clientSecret || !cardRef.current || !STRIPE_PUBLISHABLE_KEY) return;
    if (elementRef.current) return; // already mounted

    try {
      const stripe   = window.Stripe!(STRIPE_PUBLISHABLE_KEY);
      stripeRef.current = stripe;

      const elements = stripe.elements({
        clientSecret,
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary:       '#b91c1c',
            colorBackground:    '#ffffff',
            colorText:          '#111827',
            colorDanger:        '#dc2626',
            fontFamily:         'Inter, system-ui, sans-serif',
            borderRadius:       '10px',
            spacingUnit:        '4px',
          },
        },
      });

      const paymentElement = elements.create('payment', {
        layout: 'tabs',
        defaultValues: { billingDetails: { address: { country: 'NG' } } },
      });

      paymentElement.on('ready', () => setCardReady(true));
      paymentElement.on('change', (e: any) => {
        setCardComplete(e.complete);
        setCardError(e.error?.message || '');
      });

      paymentElement.mount(cardRef.current);
      elementRef.current = { stripe, elements, paymentElement };
    } catch (err: any) {
      onPaymentError('Failed to load payment form. Please try again.');
    }
  }, [scriptLoaded, clientSecret, onPaymentError]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      elementRef.current?.paymentElement?.destroy();
      elementRef.current = null;
    };
  }, []);

  const handlePay = async () => {
    if (!elementRef.current) return;
    setProcessing(true);
    setCardError('');

    try {
      const { stripe, elements } = elementRef.current;

      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: window.location.origin + '/payment/verify' },
        redirect: 'if_required',
      });

      if (error) {
        setCardError(error.message || 'Payment failed.');
        onPaymentError(error.message || 'Payment failed.');
      } else if (paymentIntent?.status === 'succeeded') {
        await onPaymentSuccess({
          method:          'stripe',
          paymentIntentId: paymentIntent.id,
          status:          'paid',
          amount,
        });
      } else {
        setCardError('Payment was not completed. Please try again.');
        onPaymentError('Payment incomplete.');
      }
    } catch (err: any) {
      setCardError(err.message || 'Unexpected error.');
      onPaymentError(err.message || 'Unexpected error.');
    } finally {
      setProcessing(false);
    }
  };

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

  return (
    <>
      {/* Load Stripe.js from CDN — no npm package needed */}
      <Script
        src="https://js.stripe.com/v3/"
        strategy="afterInteractive"
        onLoad={() => setScriptLoaded(true)}
        onError={() => onPaymentError('Failed to load Stripe. Please check your connection and try again.')}
      />

      <div className="space-y-4">
        {/* Card element container */}
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 min-h-[120px] relative">
          {!cardReady && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-50">
              <div className="w-6 h-6 border-2 border-red-200 border-t-red-700 rounded-full animate-spin" />
            </div>
          )}
          <div ref={cardRef} />
        </div>

        {cardError && (
          <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
            <Icon.PiWarningCircleBold size={15} className="flex-shrink-0" />
            {cardError}
          </div>
        )}

        {/* Pay button */}
        <button
          type="button"
          onClick={handlePay}
          disabled={!cardComplete || processing || !cardReady}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white py-3 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {processing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </>
          ) : (
            <>
              <Icon.PiLockKeyBold size={16} />
              Pay {fmt(amount)}
            </>
          )}
        </button>

        {/* Security note */}
        <div className="flex items-center justify-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Icon.PiShieldCheckBold size={13} className="text-green-500" /> SSL Encrypted
          </span>
          <span className="flex items-center gap-1">
            <Icon.PiLockKeyBold size={13} className="text-blue-500" /> Secured by Stripe
          </span>
        </div>
      </div>
    </>
  );
};

export default PaymentHandler;
