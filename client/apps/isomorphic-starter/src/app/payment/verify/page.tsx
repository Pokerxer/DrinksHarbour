'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion } from 'framer-motion';

const PaymentVerify = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [message, setMessage] = useState('Verifying your payment...');

  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');

  useEffect(() => {
    const verifyPayment = async () => {
      const paymentRef = reference || trxref;

      if (!paymentRef) {
        setStatus('error');
        setMessage('No payment reference found');
        return;
      }

      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

        // First verify the payment
        const verifyResponse = await fetch(`${API_URL}/api/payments/paystack/verify/${paymentRef}`);
        const verifyData = await verifyResponse.json();

        if (verifyData.success && verifyData.data?.status === 'paid') {
          // Retrieve pending order data from session storage
          const pendingPaymentStr = sessionStorage.getItem('pendingPayment');

          if (!pendingPaymentStr) {
            setStatus('error');
            setMessage('Order data not found. Please try again.');
            return;
          }

          const pendingPayment = JSON.parse(pendingPaymentStr);
          console.log('🔵 Pending payment data:', pendingPayment);
          
          const token = localStorage.getItem('token') || sessionStorage.getItem('token');

          // Validate required fields
          if (!pendingPayment.formData?.customer?.firstName) {
            throw new Error('Missing customer first name');
          }
          if (!pendingPayment.formData?.shipping?.address) {
            throw new Error('Missing shipping address');
          }

          // Create order with payment details
          const orderData = {
            customer: pendingPayment.formData.customer,
            shipping: pendingPayment.formData.shipping,
            paymentMethod: 'bank',
            paymentDetails: {
              method: 'paystack',
              transactionId: verifyData.data.data.transactionId,
              reference: verifyData.data.data.reference,
              amount: verifyData.data.data.amount,
              currency: verifyData.data.data.currency,
              paidAt: verifyData.data.data.paidAt,
              channel: verifyData.data.data.channel,
            },
            items: pendingPayment.cartItems.map((item: any) => ({
              productId: item.id || item._id,
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1,
              selectedSize: item.selectedSize,
              selectedColor: item.selectedColor,
            })),
            subtotal: pendingPayment.subtotal,
            shipping: pendingPayment.shipping,
            total: pendingPayment.total,
            couponCode: pendingPayment.couponCode || undefined,
            status: 'confirmed',
            paymentStatus: 'paid',
          };

          const orderResponse = await fetch(`${API_URL}/api/orders`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token && { 'Authorization': `Bearer ${token}` }),
            },
            body: JSON.stringify(orderData),
          });

          const orderResult = await orderResponse.json();

          if (!orderResponse.ok) {
            throw new Error(orderResult.message || 'Failed to create order');
          }

          // Clear pending payment data
          sessionStorage.removeItem('pendingPayment');
          localStorage.removeItem('appliedCoupon');

          setStatus('success');
          setMessage('Payment successful! Redirecting to confirmation...');

          // Redirect to order confirmation after 2 seconds
          setTimeout(() => {
            router.push(`/order-confirmation?orderId=${orderResult.order?._id || orderResult.order?.id}`);
          }, 2000);
        } else {
          setStatus('error');
          setMessage(verifyData.message || 'Payment verification failed');
        }
      } catch (error: any) {
        setStatus('error');
        setMessage(error.message || 'An error occurred while verifying payment');
      }
    };

    verifyPayment();
  }, [reference, trxref, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center px-6 max-w-md"
      >
        {status === 'verifying' && (
          <>
            <div className="w-24 h-24 mx-auto mb-6 relative">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-full h-full border-4 border-blue-200 border-t-blue-600 rounded-full"
              />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Verifying Payment</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-24 h-24 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
              <Icon.PiCheck size={48} className="text-green-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Successful!</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-24 h-24 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-6">
              <Icon.PiX size={48} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Payment Failed</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/checkout')}
              className="inline-flex items-center gap-2 py-3 px-6 bg-gray-900 text-white font-semibold rounded-xl hover:bg-gray-800 transition-colors"
            >
              <Icon.PiArrowLeft size={20} />
              Return to Checkout
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PaymentVerify;
