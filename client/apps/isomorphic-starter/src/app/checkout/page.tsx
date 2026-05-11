'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { AnimatePresence, motion } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import CouponComponent from '@/components/Coupon/Coupon';
import PaymentHandler from '@/components/Payment/PaymentHandler';
import { API_URL } from '@/lib/api';
import AddressAutocomplete, { type AddressDetails } from '@/components/AddressAutocomplete/AddressAutocomplete';

// ─── Types ────────────────────────────────────────────────────────────────────

declare global {
  interface Window { PaystackPop?: any; }
}

const NIGERIAN_STATES = [
  'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
  'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT - Abuja','Gombe',
  'Imo','Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos',
  'Nasarawa','Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto',
  'Taraba','Yobe','Zamfara',
];

// Zone-based delivery fees dispatched from Abuja warehouse (base rate, single bottle)
// Full range shown on /shipping-info. Cartons attract higher fees at dispatch.
const FREE_DELIVERY_THRESHOLD = 2_000_000;

const SHIPPING_ZONES: { states: string[]; fee: number; label: string }[] = [
  { states: ['FCT - Abuja'],                                                            fee: 2_500,  label: 'Zone 1 — FCT (Local)' },
  { states: ['Nasarawa', 'Niger', 'Kogi'],                                              fee: 10_000, label: 'Zone 2 — Abuja Environs' },
  { states: ['Kaduna', 'Plateau', 'Benue', 'Kwara'],                                   fee: 15_000, label: 'Zone 3 — North Central' },
  { states: ['Lagos', 'Ogun', 'Oyo', 'Ondo', 'Osun', 'Ekiti'],                        fee: 20_000, label: 'Zone 4 — Southwest' },
  { states: ['Enugu', 'Anambra', 'Imo', 'Abia', 'Ebonyi',
             'Rivers', 'Delta', 'Edo', 'Bayelsa', 'Cross River', 'Akwa Ibom'],         fee: 20_000, label: 'Zone 5 — SE & South-South' },
  { states: ['Kano', 'Katsina', 'Sokoto', 'Borno', 'Bauchi',
             'Gombe', 'Yobe', 'Kebbi', 'Zamfara', 'Jigawa', 'Adamawa', 'Taraba'],     fee: 18_000, label: 'Zone 6 — Far North' },
];

function getShippingFee(state: string, subtotal: number): { fee: number; zone: string } {
  if (subtotal >= FREE_DELIVERY_THRESHOLD) return { fee: 0, zone: 'Free delivery' };
  if (!state) return { fee: 0, zone: '' }; // no state selected yet — show 0 until filled
  const zone = SHIPPING_ZONES.find(z => z.states.some(s => s.toLowerCase() === state.toLowerCase()));
  return zone ? { fee: zone.fee, zone: zone.label } : { fee: 30_000, zone: 'Zone 7 — Remote' };
}

function matchNigerianState(raw: string): string {
  const s = raw.trim();
  const exact = NIGERIAN_STATES.find(n => n.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  if (/federal capital territory|abuja/i.test(s)) return 'FCT - Abuja';
  const stripped = s.replace(/\s+state$/i, '').trim();
  return NIGERIAN_STATES.find(n => n.toLowerCase() === stripped.toLowerCase())
    || NIGERIAN_STATES.find(n => n.toLowerCase().includes(stripped.toLowerCase()) || stripped.toLowerCase().includes(n.toLowerCase()))
    || s;
}

const fmt = (n: number) =>
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);

interface FormData {
  firstName: string; lastName: string; email: string; phone: string;
  address: string; city: string; state: string; zipCode: string; country: string;
  paymentMethod: 'card' | 'bank_transfer' | 'cash_on_delivery';
}
type FormErrors = Partial<Record<keyof FormData, string>>;

const PAYMENT_METHODS = [
  { id: 'cash_on_delivery', name: 'Cash on Delivery',   description: 'Pay cash when your order arrives', icon: Icon.PiMoneyBold, badge: null },
  { id: 'card',             name: 'Card Payment',        description: 'Visa, Mastercard — powered by Stripe', icon: Icon.PiCreditCardBold, badge: 'Instant' },
  { id: 'bank_transfer',    name: 'Bank Transfer / USSD', description: 'Pay via Paystack — card, bank, USSD', icon: Icon.PiBankBold, badge: null },
] as const;

// ─── Input field ─────────────────────────────────────────────────────────────

const inputCls = (err?: string) =>
  `w-full px-4 py-2.5 border rounded-xl text-sm outline-none transition-all ${
    err
      ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-2 focus:ring-red-100'
      : 'border-gray-200 bg-gray-50 focus:bg-white focus:border-red-400 focus:ring-2 focus:ring-red-100'
  }`;

function Field({ label, name, type = 'text', placeholder, required = true, icon: Ic, value, error, onChange }: {
  label: string; name: string; type?: string; placeholder?: string; required?: boolean;
  icon?: React.ElementType; value: string; error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-gray-600 mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Ic && <Ic size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />}
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className={`${inputCls(error)} ${Ic ? 'pl-10' : ''}`}
        />
      </div>
      {error && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><Icon.PiWarningCircleBold size={11} />{error}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const { cartState, clearCart, syncCartToServer, loadServerCart, validateCartItems, applyValidationUpdates, validationMap } = useCart();

  const [mounted,         setMounted]         = useState(false);
  const [isLoading,       setIsLoading]       = useState(false);
  const [error,           setError]           = useState('');
  const [activePayment,   setActivePayment]   = useState<string>('cash_on_delivery');
  const [couponDiscount,  setCouponDiscount]  = useState(0);
  const [appliedCoupon,   setAppliedCoupon]   = useState('');
  const [showStripeForm,  setShowStripeForm]  = useState(false);
  const [stripeData,      setStripeData]      = useState<{ clientSecret: string; paymentIntentId: string } | null>(null);
  const [paystackReady,   setPaystackReady]   = useState(false);
  const [addressDetails,  setAddressDetails]  = useState<AddressDetails | null>(null);
  // Validation modal state
  const [validationIssues, setValidationIssues] = useState<Array<{ name: string; status: string; currentPrice?: number; oldPrice?: number; maxQuantity?: number | null }>>([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [pendingPayment, setPendingPayment] = useState<null | (() => Promise<void>)>(null);

  const [form, setForm] = useState<FormData>({
    firstName: '', lastName: '', email: '', phone: '',
    address: '', city: '', state: '', zipCode: '', country: 'Nigeria',
    paymentMethod: 'cash_on_delivery',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');
    if (!token) { router.push('/login?redirect=/checkout'); return; }
    setMounted(true);
    loadServerCart();
  }, [router, loadServerCart]);

  // Pre-fill from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('user') || sessionStorage.getItem('user');
    if (!stored) return;
    try {
      const u = JSON.parse(stored);
      setForm(f => ({
        ...f,
        firstName: u.firstName || f.firstName,
        lastName:  u.lastName  || f.lastName,
        email:     u.email     || f.email,
        phone:     u.phone     || f.phone,
      }));
    } catch {}
  }, [mounted]);

  // ── Derived totals ────────────────────────────────────────────────────────
  const subtotal  = cartState.cartArray.reduce((s, i) => s + i.price * (i.quantity || 1), 0);
  const { fee: shipping, zone: shippingZone } = getShippingFee(form.state, subtotal);
  const discount  = Math.min(couponDiscount, subtotal);
  const total     = Math.max(0, subtotal - discount + shipping);

  // ── Form helpers ──────────────────────────────────────────────────────────
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm(f => ({ ...f, [name]: value }));
    if (errors[name as keyof FormErrors]) setErrors(p => { const n = { ...p }; delete n[name as keyof FormErrors]; return n; });
  };

  const handleAddressSelect = (address: string, details?: AddressDetails) => {
    setAddressDetails(details ?? null);
    setForm(f => ({
      ...f,
      address,
      ...(details?.city     ? { city:    details.city } : {}),
      ...(details?.postcode ? { zipCode: details.postcode } : {}),
      ...(details?.state    ? { state:   matchNigerianState(details.state) } : {}),
    }));
  };

  const validate = useCallback((): boolean => {
    const e: FormErrors = {};
    if (!form.firstName.trim()) e.firstName = 'Required';
    if (!form.lastName.trim())  e.lastName  = 'Required';
    if (!form.email.trim())     e.email     = 'Required';
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
    if (!form.phone.trim())     e.phone     = 'Required';
    if (!form.address.trim())   e.address   = 'Required';
    if (!form.city.trim())      e.city      = 'Required';
    if (!form.state.trim())     e.state     = 'Required';
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  // ── Cart item mapping ─────────────────────────────────────────────────────
  const buildItems = () =>
    cartState.cartArray.map(item => ({
      productId:    item.selectedProductId || item.id || item._id,
      name:         item.name,
      price:        item.price,
      quantity:     item.quantity || 1,
      sizeId:       item.selectedSizeId    || null,
      subProductId: item.selectedSubProductId || null,
      tenantId:     item.selectedVendorId  || null,
    }));

  const buildShipping = () => ({
    address: form.address, city: form.city, state: form.state,
    zipCode: form.zipCode, country: form.country,
    ...(addressDetails ? { coordinates: { latitude: addressDetails.lat, longitude: addressDetails.lon } } : {}),
  });

  const buildCustomer = () => ({
    firstName: form.firstName, lastName: form.lastName,
    email: form.email, phone: form.phone,
  });

  const token = () => localStorage.getItem('token') || sessionStorage.getItem('token') || '';

  // ── After successful payment: create order ────────────────────────────────
  const createOrderAfterPayment = async (paymentDetails: any) => {
    const res = await fetch(`${API_URL}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
      body: JSON.stringify({
        customer: buildCustomer(),
        shipping: buildShipping(),
        paymentMethod: activePayment,
        paymentDetails,
        items: buildItems(),
        subtotal,
        shippingFee: shipping,
        total,
        couponCode: appliedCoupon || undefined,
        status: 'processing',
        paymentStatus: 'paid',
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create order');
    return data.data?.order?._id || data.data?.order?.id || data.order?._id;
  };

  // ── Stripe ────────────────────────────────────────────────────────────────
  const initStripe = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_URL}/api/payments/stripe/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          amount: total, currency: 'ngn',
          metadata: { customerEmail: form.email, customerName: `${form.firstName} ${form.lastName}` },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not initialise card payment');
      setStripeData({ clientSecret: data.data.clientSecret, paymentIntentId: data.data.paymentIntentId });
      setShowStripeForm(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStripeSuccess = async (paymentResult: any) => {
    setIsLoading(true);
    try {
      const orderId = await createOrderAfterPayment({
        method: 'stripe',
        transactionId: paymentResult.paymentIntentId,
        status: 'paid',
        paidAt: new Date().toISOString(),
        amount: total,
      });
      clearCart();
      localStorage.setItem('customerEmail', form.email);
      router.push(`/order-confirmation?orderId=${orderId}`);
    } catch (e: any) {
      setError(e.message || 'Payment succeeded but order creation failed. Contact support.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Paystack ──────────────────────────────────────────────────────────────
  const initPaystack = async () => {
    setIsLoading(true);
    setError('');
    try {
      const PAYSTACK_PUBLIC_KEY = process.env.NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY || '';

      // If inline JS is loaded, use the popup for better UX
      if (paystackReady && window.PaystackPop && PAYSTACK_PUBLIC_KEY) {
        const handler = window.PaystackPop.setup({
          key:      PAYSTACK_PUBLIC_KEY,
          email:    form.email,
          amount:   Math.round(total * 100), // kobo
          currency: 'NGN',
          ref:      `DH-${Date.now()}`,
          metadata: {
            custom_fields: [
              { display_name: 'Customer Name',  variable_name: 'customer_name',  value: `${form.firstName} ${form.lastName}` },
              { display_name: 'Customer Phone', variable_name: 'customer_phone', value: form.phone },
            ],
          },
          callback: async (response: any) => {
            // Verify with our server, then create order
            try {
              setIsLoading(true);
              const verifyRes  = await fetch(`${API_URL}/api/payments/paystack/verify/${response.reference}`, {
                headers: { Authorization: `Bearer ${token()}` },
              });
              const verifyData = await verifyRes.json();
              if (!verifyRes.ok || !verifyData.success) throw new Error(verifyData.message || 'Verification failed');

              const pInfo   = verifyData.data;
              const orderId = await createOrderAfterPayment({
                method: 'paystack',
                transactionId: pInfo.reference || response.reference,
                paystackTransactionId: pInfo.transactionId,
                status: 'paid',
                paidAt: pInfo.paidAt || new Date().toISOString(),
                channel: pInfo.channel,
                amount: pInfo.amount,
              });
              clearCart();
              localStorage.setItem('customerEmail', form.email);
              router.push(`/order-confirmation?orderId=${orderId}`);
            } catch (e: any) {
              setError(e.message || 'Payment received but order creation failed. Contact support.');
            } finally {
              setIsLoading(false);
            }
          },
          onClose: () => {
            setIsLoading(false);
          },
        });
        handler.openIframe();
        return; // popup handles the rest
      }

      // Fallback: redirect to Paystack
      const res  = await fetch(`${API_URL}/api/payments/paystack/initialize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          amount: total, email: form.email,
          metadata: { customerName: `${form.firstName} ${form.lastName}`, customerPhone: form.phone },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not initialise payment');

      const pending = {
        reference: data.data.reference,
        formData: { customer: buildCustomer(), shipping: buildShipping() },
        cartItems: cartState.cartArray,
        subtotal, shippingFee: shipping, total,
        couponCode: appliedCoupon,
      };
      localStorage.setItem('pendingPayment', JSON.stringify(pending));
      window.location.href = data.data.authorizationUrl;

    } catch (e: any) {
      setError(e.message);
      setIsLoading(false);
    }
  };

  // ── COD submit ────────────────────────────────────────────────────────────
  const submitCOD = async () => {
    setIsLoading(true);
    try {
      await syncCartToServer();
      const res  = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}` },
        body: JSON.stringify({
          customer: buildCustomer(),
          shipping: buildShipping(),
          paymentMethod: 'cash_on_delivery',
          items: buildItems(),
          subtotal, shippingFee: shipping, total,
          couponCode: appliedCoupon || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to place order');
      clearCart();
      localStorage.setItem('customerEmail', form.email);
      const orderId = data.data?.order?._id || data.data?.order?.id || data.order?._id;
      router.push(`/order-confirmation?orderId=${orderId}`);
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // ── Pre-checkout cart validation ─────────────────────────────────────────
  /**
   * Validates stock & prices before allowing payment to proceed.
   * If issues exist, shows a modal. If clean (or after user accepts), runs `proceed`.
   */
  const validateBeforeCheckout = async (proceed: () => Promise<void>) => {
    setIsLoading(true);
    setError('');
    try {
      await validateCartItems();
      // validateCartItems populates validationMap — read it directly from state after awaiting
      // But since state updates are async, re-fetch from the API inline here to be sure
      const payload = cartState.cartArray
        .filter(item => item.selectedSubProductId)
        .map(item => ({
          subProductId: item.selectedSubProductId,
          sizeId:       item.selectedSizeId       || null,
          tenantId:     item.selectedVendorId     || null,
          quantity:     item.quantity || 1,
          price:        item.price || 0,
        }));

      if (payload.length === 0) {
        setIsLoading(false);
        await proceed();
        return;
      }

      const res  = await fetch(`${API_URL}/api/cart/validate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ items: payload }),
      });
      const data = await res.json();

      if (!data.success) {
        // Can't validate — proceed with a warning
        setIsLoading(false);
        await proceed();
        return;
      }

      const issues = (data.data.items as any[]).filter(v => v.status !== 'ok');
      if (issues.length === 0) {
        setIsLoading(false);
        await proceed();
        return;
      }

      // Build human-readable issue list
      const issueDetails = issues.map(v => {
        const cartItem = cartState.cartArray.find(
          i => i.selectedSubProductId === v.subProductId && (i.selectedSizeId || null) === (v.sizeId || null)
        );
        return {
          name: cartItem?.name || 'Item',
          status: v.status,
          currentPrice: v.currentPrice,
          oldPrice: v.oldPrice,
          maxQuantity: v.maxQuantity,
        };
      });

      setValidationIssues(issueDetails);
      setPendingPayment(() => proceed);
      setIsLoading(false);
      setShowValidationModal(true);
    } catch {
      setIsLoading(false);
      // On validation error, let them proceed — server will catch real issues
      await proceed();
    }
  };

  // User accepts the validation changes and continues
  const handleAcceptAndContinue = async () => {
    setShowValidationModal(false);
    applyValidationUpdates();
    const proceed = pendingPayment;
    setPendingPayment(null);
    if (proceed) {
      // Small delay for state to settle after applyValidationUpdates
      setTimeout(async () => { await proceed(); }, 50);
    }
  };

  // ── Main submit ───────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate())                     return;
    if (cartState.cartArray.length === 0) { setError('Your cart is empty'); return; }

    if (activePayment === 'card') {
      await validateBeforeCheckout(initStripe);
      return;
    }
    if (activePayment === 'bank_transfer') {
      await validateBeforeCheckout(initPaystack);
      return;
    }
    await validateBeforeCheckout(submitCOD);
  };

  // ── Loading / empty states ────────────────────────────────────────────────
  if (!mounted) return (
    <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-red-100 border-t-red-700 rounded-full animate-spin" />
    </div>
  );

  if (cartState.cartArray.length === 0) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center px-6">
        <Icon.PiShoppingCartBold size={56} className="mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-black text-gray-900 mb-2">Your cart is empty</h2>
        <p className="text-gray-500 text-sm mb-6">Add products before checking out.</p>
        <Link href="/shop" className="inline-flex items-center gap-2 bg-gradient-to-br from-red-700 to-red-900 text-white px-6 py-3 rounded-xl font-bold text-sm">
          <Icon.PiStorefrontBold size={16} /> Browse Shop
        </Link>
      </div>
    </div>
  );

  return (
    <>
      {/* Paystack inline script */}
      <Script
        src="https://js.paystack.co/v1/inline.js"
        strategy="afterInteractive"
        onLoad={() => setPaystackReady(true)}
      />

      {/* Progress bar */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-20">
        <div className="container mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <Link href="/cart" className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-red-700 transition-colors">
            <Icon.PiArrowLeftBold size={15} /> Back to Cart
          </Link>
          <div className="flex items-center gap-2 text-xs font-semibold">
            <div className="flex items-center gap-1.5 text-green-600">
              <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center text-[10px] font-black">1</div>
              <span className="hidden sm:inline">Cart</span>
            </div>
            <div className="w-6 h-0.5 bg-green-500" />
            <div className="flex items-center gap-1.5 text-red-700">
              <div className="w-5 h-5 rounded-full bg-red-700 text-white flex items-center justify-center text-[10px] font-black">2</div>
              <span className="hidden sm:inline">Checkout</span>
            </div>
            <div className="w-6 h-0.5 bg-gray-200" />
            <div className="flex items-center gap-1.5 text-gray-400">
              <div className="w-5 h-5 rounded-full bg-gray-200 text-gray-400 flex items-center justify-center text-[10px] font-black">3</div>
              <span className="hidden sm:inline">Confirmation</span>
            </div>
          </div>
          <div className="w-28" />
        </div>
      </div>

      {/* ── Validation Modal ───────────────────────────────────────────── */}
      <AnimatePresence>
        {showValidationModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 16 }}
              className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 z-50 overflow-hidden"
            >
              <div className="bg-gradient-to-r from-gray-900 to-red-950 px-6 py-4 flex items-center gap-3">
                <Icon.PiWarningCircleBold size={20} className="text-amber-400 flex-shrink-0" />
                <h3 className="text-white font-black text-sm">Cart Updated</h3>
              </div>
              <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                  Some items in your cart have changed since you added them. Please review before continuing:
                </p>
                <div className="space-y-2.5 max-h-60 overflow-y-auto mb-5">
                  {validationIssues.map((issue, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${
                      issue.status === 'out_of_stock' || issue.status === 'unavailable'
                        ? 'bg-red-50 border-red-100'
                        : 'bg-amber-50 border-amber-100'
                    }`}>
                      {(issue.status === 'out_of_stock' || issue.status === 'unavailable')
                        ? <Icon.PiXCircleBold size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                        : <Icon.PiWarningBold  size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{issue.name}</p>
                        {(issue.status === 'out_of_stock' || issue.status === 'unavailable') && (
                          <p className="text-xs text-red-600 mt-0.5">Out of stock — will be removed from your cart</p>
                        )}
                        {issue.status === 'price_changed' && issue.currentPrice != null && (
                          <p className="text-xs text-amber-700 mt-0.5">
                            Price changed: {fmt(issue.oldPrice ?? 0)} → <strong>{fmt(issue.currentPrice)}</strong>
                          </p>
                        )}
                        {issue.status === 'quantity_reduced' && issue.maxQuantity != null && (
                          <p className="text-xs text-amber-700 mt-0.5">
                            Only <strong>{issue.maxQuantity}</strong> unit{issue.maxQuantity !== 1 ? 's' : ''} available — quantity will be adjusted
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setShowValidationModal(false); setPendingPayment(null); router.push('/cart'); }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-semibold rounded-xl text-sm hover:bg-gray-50 transition-colors"
                  >
                    Back to Cart
                  </button>
                  <button
                    onClick={handleAcceptAndContinue}
                    className="flex-1 px-4 py-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white font-bold rounded-xl text-sm hover:from-red-800 hover:to-red-950 transition-all"
                  >
                    Accept &amp; Continue
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <div className="bg-gray-50 min-h-screen">
        <div className="container mx-auto max-w-6xl px-4 py-8">
          <form onSubmit={handleSubmit}>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="mb-5 flex items-center gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-3.5"
                >
                  <Icon.PiWarningCircleBold size={18} className="text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-700 font-medium">{error}</p>
                  <button type="button" onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600">
                    <Icon.PiXBold size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="flex flex-col lg:flex-row gap-6">

              {/* ── Left: Forms ─────────────────────────────────────────── */}
              <div className="lg:w-3/5 space-y-5">

                {/* Customer info */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-red-950">
                    <Icon.PiUserBold size={16} className="text-red-400" />
                    <h2 className="text-sm font-black text-white">Customer Information</h2>
                  </div>
                  <div className="p-5 grid sm:grid-cols-2 gap-4">
                    <Field label="First Name"    name="firstName" icon={Icon.PiUserBold}     value={form.firstName} error={errors.firstName} onChange={handleChange} />
                    <Field label="Last Name"     name="lastName"  icon={Icon.PiUserBold}     value={form.lastName}  error={errors.lastName}  onChange={handleChange} />
                    <Field label="Email Address" name="email"     type="email" icon={Icon.PiEnvelopeBold} value={form.email} error={errors.email} onChange={handleChange} />
                    <Field label="Phone Number"  name="phone"     type="tel"   icon={Icon.PiPhoneBold}   placeholder="+234" value={form.phone} error={errors.phone} onChange={handleChange} />
                  </div>
                </div>

                {/* Shipping address */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-red-950">
                    <Icon.PiTruckBold size={16} className="text-red-400" />
                    <h2 className="text-sm font-black text-white">Delivery Address</h2>
                  </div>
                  <div className="p-5 space-y-4">
                    <AddressAutocomplete
                      value={form.address}
                      onChange={handleAddressSelect}
                      onClearError={() => {}}
                      error={errors.address}
                      label="Street Address"
                      placeholder="Start typing your address…"
                    />
                    <div className="grid sm:grid-cols-3 gap-4">
                      <Field label="City / LGA" name="city" icon={Icon.PiBuildingsBold} value={form.city} error={errors.city} onChange={handleChange} />
                      <div>
                        <label className="text-xs font-semibold text-gray-600 mb-1.5 block">State <span className="text-red-500">*</span></label>
                        <div className="relative">
                          <Icon.PiMapPinBold size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                          <select
                            name="state" value={form.state} onChange={handleChange}
                            className={`${inputCls(errors.state)} pl-10 pr-8 appearance-none`}
                          >
                            <option value="">Select…</option>
                            {NIGERIAN_STATES.map(s => <option key={s}>{s}</option>)}
                          </select>
                          <Icon.PiCaretDownBold size={12} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                        {errors.state && <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><Icon.PiWarningCircleBold size={11} />{errors.state}</p>}
                      </div>
                      <Field label="Postal Code" name="zipCode" required={false} icon={Icon.PiMapTrifoldBold} value={form.zipCode} onChange={handleChange} />
                    </div>
                  </div>
                </div>

                {/* Payment method */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-red-950">
                    <Icon.PiCreditCardBold size={16} className="text-red-400" />
                    <h2 className="text-sm font-black text-white">Payment Method</h2>
                  </div>
                  <div className="p-5">
                    {/* Stripe form */}
                    <AnimatePresence>
                      {showStripeForm && stripeData && (
                        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <Icon.PiCreditCardBold size={16} className="text-red-700" /> Enter card details
                            </p>
                            <button
                              type="button"
                              onClick={() => { setShowStripeForm(false); setStripeData(null); }}
                              className="text-xs text-gray-400 hover:text-red-700 flex items-center gap-1"
                            >
                              <Icon.PiArrowLeftBold size={12} /> Change method
                            </button>
                          </div>
                          <PaymentHandler
                            clientSecret={stripeData.clientSecret}
                            amount={total}
                            onPaymentSuccess={handleStripeSuccess}
                            onPaymentError={(msg) => { setError(msg); setShowStripeForm(false); setStripeData(null); }}
                          />
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {!showStripeForm && (
                      <div className="space-y-2.5">
                        {PAYMENT_METHODS.map(({ id, name, description, icon: Ic, badge }) => {
                          const active = activePayment === id;
                          return (
                            <label
                              key={id}
                              onClick={() => { setActivePayment(id); setForm(f => ({ ...f, paymentMethod: id as any })); }}
                              className={`flex items-center gap-3.5 p-3.5 rounded-xl border cursor-pointer transition-all ${
                                active ? 'border-red-200 bg-red-50' : 'border-gray-200 hover:border-red-100 bg-white hover:bg-gray-50'
                              }`}
                            >
                              <input type="radio" name="payment" checked={active} readOnly className="sr-only" />
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all ${
                                active ? 'bg-red-700 text-white' : 'bg-gray-100 text-gray-500'
                              }`}>
                                <Ic size={19} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold text-sm ${active ? 'text-red-800' : 'text-gray-800'}`}>{name}</p>
                                  {badge && <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{badge}</span>}
                                </div>
                                <p className="text-xs text-gray-400 mt-0.5">{description}</p>
                              </div>
                              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                active ? 'border-red-700 bg-red-700' : 'border-gray-300'
                              }`}>
                                {active && <Icon.PiCheckBold size={11} className="text-white" />}
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Right: Order summary ─────────────────────────────────── */}
              <div className="lg:w-2/5">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden sticky top-20">
                  <div className="px-5 py-4 border-b border-gray-100 bg-gradient-to-r from-gray-900 to-red-950">
                    <h2 className="text-sm font-black text-white flex items-center gap-2">
                      <Icon.PiShoppingCartBold size={16} /> Order Summary
                    </h2>
                    <p className="text-xs text-red-300 mt-0.5">{cartState.cartArray.length} item{cartState.cartArray.length !== 1 ? 's' : ''}</p>
                  </div>

                  <div className="p-5 space-y-4">
                    {/* Items */}
                    <div className="space-y-3 max-h-52 overflow-y-auto pr-1">
                      {cartState.cartArray.map(item => {
                        const img = item.thumbImage?.[0] || (item as any).primaryImage?.url || (item as any).images?.[0]?.url;
                        return (
                          <div key={item.cartItemId} className="flex items-center gap-3 bg-gray-50 rounded-xl p-2.5">
                            <div className="w-12 h-12 rounded-xl overflow-hidden bg-white border border-gray-100 flex-shrink-0">
                              {img
                                ? <Image src={img} alt={item.name} width={48} height={48} className="w-full h-full object-contain p-0.5" />
                                : <div className="w-full h-full flex items-center justify-center"><Icon.PiImageBold size={16} className="text-gray-300" /></div>}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                              <p className="text-xs text-gray-400">Qty: {item.quantity || 1}{item.selectedSize ? ` · ${item.selectedSize}` : ''}</p>
                            </div>
                            <span className="text-sm font-black text-gray-900 flex-shrink-0">{fmt(item.price * (item.quantity || 1))}</span>
                          </div>
                        );
                      })}
                    </div>

                    {/* Coupon */}
                    <CouponComponent
                      onCouponApplied={(code, disc) => { setCouponDiscount(disc); setAppliedCoupon(code); }}
                      onCouponRemoved={() => { setCouponDiscount(0); setAppliedCoupon(''); }}
                      cartItems={cartState.cartArray}
                      subtotal={subtotal}
                      shipping={shipping}
                    />

                    {/* Totals */}
                    <div className="space-y-2 text-sm border-t border-gray-100 pt-3">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-green-600">
                          <span>Discount</span><span className="font-semibold">-{fmt(discount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600">
                        <span>Delivery{shippingZone ? <> <span className="text-[11px] text-gray-400">({shippingZone})</span></> : null}</span>
                        <span className={`font-semibold ${shipping === 0 && form.state ? 'text-green-600' : ''}`}>
                          {!form.state
                            ? <span className="text-gray-400 text-xs">Select state</span>
                            : shipping === 0 ? 'Free' : fmt(shipping)}
                        </span>
                      </div>
                      {shipping === 0 && subtotal >= FREE_DELIVERY_THRESHOLD && (
                        <p className="text-xs text-green-600 flex items-center gap-1">
                          <Icon.PiCheckCircleBold size={12} /> Free delivery on orders ≥ ₦2,000,000
                        </p>
                      )}
                      {form.state && shipping > 0 && (
                        <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Icon.PiInfoBold size={12} /> Base rate — cartons &amp; bulk orders may cost more
                        </p>
                      )}
                    </div>

                    <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                      <span className="font-black text-gray-900">Total</span>
                      <span className="text-xl font-black text-gray-900">{fmt(total)}</span>
                    </div>

                    {/* Submit */}
                    {!showStripeForm && (
                      <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-2.5 bg-gradient-to-br from-red-700 to-red-900 text-white py-3.5 rounded-xl font-bold text-sm hover:from-red-800 hover:to-red-950 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                      >
                        {isLoading ? (
                          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Processing…</>
                        ) : (
                          <>
                            <Icon.PiLockKeyBold size={16} />
                            {activePayment === 'cash_on_delivery' ? 'Place Order' : `Pay ${fmt(total)}`}
                          </>
                        )}
                      </button>
                    )}

                    {/* Trust badges */}
                    <div className="flex items-center justify-center gap-4 text-xs text-gray-400 pt-1">
                      <span className="flex items-center gap-1"><Icon.PiShieldCheckBold size={13} className="text-green-500" /> Secure</span>
                      <span className="flex items-center gap-1"><Icon.PiLockKeyBold size={13} className="text-blue-500" /> Encrypted</span>
                      <span className="flex items-center gap-1"><Icon.PiArrowCounterClockwiseBold size={13} className="text-amber-500" /> Easy Returns</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </form>
        </div>
      </div>
    </>
  );
}
