'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as Icon from 'react-icons/pi';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import CouponComponent from '@/components/Coupon/Coupon';
import PaymentHandler from '@/components/Payment/PaymentHandler';
import AddressAutocomplete from '@/components/AddressAutocomplete/AddressAutocomplete';

interface FormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  paymentMethod: 'card' | 'bank_transfer' | 'cash_on_delivery';
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  paymentMethod?: string;
}

const paymentMethods = [
  {
    id: 'cash_on_delivery',
    name: 'Cash on Delivery',
    description: 'Pay when you receive your order',
    icon: Icon.PiMoney,
  },
  {
    id: 'card',
    name: 'Credit/Debit Card',
    description: 'Pay securely with Stripe',
    icon: Icon.PiCreditCard,
  },
  {
    id: 'bank_transfer',
    name: 'Bank Transfer',
    description: 'Pay securely with Paystack',
    icon: Icon.PiBuilding,
  },
] as const;

interface InputFieldProps {
  label: string;
  name: keyof FormData;
  type?: string;
  placeholder?: string;
  required?: boolean;
  icon?: any;
  gridClass?: string;
  value: string;
  error?: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClearError: (name: string) => void;
}

// Simple InputField component without React.memo to avoid stale closures
const InputField = ({ 
  label, 
  name, 
  type = 'text', 
  placeholder,
  required = true,
  icon: IconComponent,
  gridClass = '',
  value,
  error,
  onChange,
  onClearError
}: InputFieldProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e);
    if (onClearError && error) {
      onClearError(name as string);
    }
  };

  return (
    <div className={gridClass}>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {IconComponent && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
            <IconComponent size={18} />
          </div>
        )}
        <input
          type={type}
          name={name}
          value={value || ''}
          onChange={handleChange}
          placeholder={placeholder}
          className={`w-full ${IconComponent ? 'pl-10' : 'pl-3'} pr-3 py-2.5 rounded-lg border text-sm
            ${error 
              ? 'border-red-400 bg-red-50 focus:border-red-500 focus:ring-1 focus:ring-red-200' 
              : 'border-gray-300 focus:border-gray-900 focus:ring-1 focus:ring-gray-200'
            } outline-none transition-colors`}
        />
      </div>
      {error && (
        <p className="mt-1 text-xs text-red-500 flex items-center gap-1">
          <Icon.PiWarningCircle size={12} />
          {error}
        </p>
      )}
    </div>
  );
};

const Checkout = () => {
  const router = useRouter();
  const { cartState, clearCart, syncCartToServer, loadServerCart } = useCart();
  const [mounted, setMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [activePayment, setActivePayment] = useState<string>('cod');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [appliedCouponCode, setAppliedCouponCode] = useState('');
  const [createdOrderId, setCreatedOrderId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentData, setPaymentData] = useState<any>(null);

  useEffect(() => {
    const initCheckout = async () => {
      setMounted(true);
      await loadServerCart();
    };
    initCheckout();
  }, []);

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zipCode: '',
    country: 'Nigeria',
    paymentMethod: 'cod',
  });

  // Ensure all form values are strings (not undefined)
  const getSafeValue = (value: string | undefined): string => value ?? '';
  const [errors, setErrors] = useState<FormErrors>({});
  const [addressDetails, setAddressDetails] = useState<any>(null);

  const subtotal = cartState.cartArray.reduce((sum, item) => {
    return sum + (item.price * (item.quantity || 1));
  }, 0);
  const shipping = subtotal > 50000 ? 0 : 2500;
  const discountedSubtotal = Math.max(0, subtotal - couponDiscount);
  const total = Math.max(0, discountedSubtotal + shipping);

  const validateForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    console.log('🔵 Validating form...');
    console.log('   Form data:', formData);

    if (!formData.firstName || !formData.firstName.trim()) newErrors.firstName = 'First name is required';
    if (!formData.lastName || !formData.lastName.trim()) newErrors.lastName = 'Last name is required';
    if (!formData.email || !formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
    }
    if (!formData.phone || !formData.phone.trim()) newErrors.phone = 'Phone number is required';
    if (!formData.address || !formData.address.trim()) newErrors.address = 'Address is required';
    if (!formData.city || !formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.state || !formData.state.trim()) newErrors.state = 'State is required';
    if (!formData.zipCode || !formData.zipCode.trim()) newErrors.zipCode = 'ZIP code is required';
    if (!formData.country || !formData.country.trim()) newErrors.country = 'Country is required';

    console.log('   Validation errors:', newErrors);
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    console.log(`🔵 Input changed: ${name} = "${value}"`);
    
    setFormData(prev => {
      const newData = { ...prev, [name]: value };
      console.log('   Updated formData:', newData);
      return newData;
    });
    
    // Clear error for this field
    setErrors(prev => {
      if (prev[name as keyof FormErrors]) {
        const newErrors = { ...prev };
        delete newErrors[name as keyof FormErrors];
        return newErrors;
      }
      return prev;
    });
  };

  const handleClearError = useCallback((name: string) => {
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  }, [errors]);

  const handleAddressSelect = (address: string, placeDetails?: any) => {
    console.log('🔵 Address selected:', address);
    console.log('   Place details:', placeDetails);
    
    setAddressDetails(placeDetails);
    
    // Update form data with all fields at once
    const updates: Partial<FormData> = { address };
    
    if (placeDetails?.addressComponents) {
      const components = placeDetails.addressComponents;
      
      // Auto-fill city from locality or sublocality
      const city = components['locality'] || components['sublocality'] || components['administrative_area_level_2'];
      if (city) {
        updates.city = city;
        console.log('   Auto-filled city:', city);
      }
      
      // Auto-fill state from administrative_area_level_1
      const state = components['administrative_area_level_1'];
      if (state) {
        updates.state = state;
        console.log('   Auto-filled state:', state);
      }
      
      // Auto-fill zip code from postal_code
      const zipCode = components['postal_code'];
      if (zipCode) {
        updates.zipCode = zipCode;
        console.log('   Auto-filled zipCode:', zipCode);
      }
    }
    
    setFormData(prev => ({ ...prev, ...updates }));
    
    // Clear errors for updated fields
    setErrors(prev => {
      const newErrors = { ...prev };
      Object.keys(updates).forEach(key => {
        delete newErrors[key as keyof FormErrors];
      });
      return newErrors;
    });
  };

  const handlePayment = (item: string) => {
    setActivePayment(item);
    setFormData(prev => ({ ...prev, paymentMethod: item as 'card' | 'bank' | 'cod' }));
    setShowPaymentModal(false);
  };

  const handleCouponApplied = (code: string, discount: number, couponData?: any) => {
    setCouponDiscount(discount);
    setAppliedCouponCode(code);
  };

  const handleCouponRemoved = () => {
    setCouponDiscount(0);
    setAppliedCouponCode('');
  };

  const getShippingDisplay = () => {
    if (couponDiscount >= shipping && shipping > 0) {
      return { text: 'Free', cost: 0 };
    }
    return { text: `₦${shipping.toLocaleString()}`, cost: shipping };
  };

  const shippingDisplay = getShippingDisplay();
  const finalTotal = subtotal - couponDiscount + shippingDisplay.cost;

  const initializeOnlinePayment = async () => {
    setIsLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

      if (activePayment === 'card') {
        const response = await fetch(`${API_URL}/api/payments/stripe/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({
            amount: finalTotal,
            currency: 'ngn',
            metadata: {
              customerEmail: formData.email,
              customerName: `${formData.firstName} ${formData.lastName}`,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to initialize Stripe payment');
        }

        setPaymentData({
          method: 'stripe',
          clientSecret: data.data.clientSecret,
          paymentIntentId: data.data.paymentIntentId,
        });
        setShowPaymentModal(true);
      } else if (activePayment === 'bank') {
        // Validate all required fields before redirecting to Paystack
        console.log('🔵 Validating form data before Paystack redirect:');
        console.log('   Form data:', formData);
        
        if (!formData.address || !formData.city || !formData.state || !formData.zipCode || !formData.country) {
          console.error('   ❌ Missing shipping information');
          setError('Please complete all shipping address fields');
          setIsLoading(false);
          return;
        }

        const response = await fetch(`${API_URL}/api/payments/paystack/initialize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
          body: JSON.stringify({
            amount: finalTotal,
            email: formData.email,
            metadata: {
              customerName: `${formData.firstName} ${formData.lastName}`,
              customerPhone: formData.phone,
            },
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.message || 'Failed to initialize Paystack payment');
        }

        if (data.data.authorizationUrl) {
          const paymentData = {
            reference: data.data.reference,
            method: 'paystack',
            formData: {
              customer: {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                phone: formData.phone,
              },
              shipping: {
                address: formData.address,
                city: formData.city,
                state: formData.state,
                zipCode: formData.zipCode,
                country: formData.country,
                coordinates: addressDetails ? {
                  latitude: addressDetails.latitude,
                  longitude: addressDetails.longitude,
                  placeId: addressDetails.placeId,
                } : undefined,
              },
            },
            cartItems: cartState.cartArray,
        subtotal,
        shippingFee: shippingDisplay.cost,
        total: finalTotal,
            couponCode: appliedCouponCode,
          };
          
          console.log('🔵 Saving to sessionStorage:', paymentData);
          sessionStorage.setItem('pendingPayment', JSON.stringify(paymentData));
          window.location.href = data.data.authorizationUrl;
        } else {
          throw new Error('No authorization URL received');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to initialize payment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔵 Form submitted');
    console.log('   Current form data:', formData);

    if (!validateForm()) {
      console.log('   ❌ Validation failed');
      return;
    }

    if (cartState.cartArray.length === 0) {
      setError('Your cart is empty');
      return;
    }

    if (activePayment === 'card' || activePayment === 'bank') {
      await initializeOnlinePayment();
      return;
    }

    setIsLoading(true);
    try {
      await syncCartToServer();

      const orderData = {
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        shipping: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
        },
        paymentMethod: formData.paymentMethod,
        items: cartState.cartArray.map(item => ({
          productId: item.selectedProductId || item.id || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          sizeId: item.selectedSizeId || null,
          subProductId: item.selectedSubProductId || null,
          tenantId: item.selectedVendorId || null,
        })),
        subtotal,
        shippingFee: shippingDisplay.cost,
        total: finalTotal,
        couponCode: appliedCouponCode || undefined,
      };
      
      console.log('🔵 Sending order data:', orderData);

      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      const response = await fetch('http://localhost:5001/api/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to place order');
      }

      clearCart();
      localStorage.removeItem('appliedCoupon');
      // Save customer email for order confirmation page (guest users)
      localStorage.setItem('customerEmail', formData.email);
      const orderId = data.data?.order?._id || data.data?.order?.id || data.order?._id || data.order?.id;
      router.push(`/order-confirmation?orderId=${orderId}`);
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData: any) => {
    setIsLoading(true);
    
    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

      const orderData = {
        customer: {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          phone: formData.phone,
        },
        shipping: {
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zipCode: formData.zipCode,
          country: formData.country,
          coordinates: addressDetails ? {
            latitude: addressDetails.latitude,
            longitude: addressDetails.longitude,
            placeId: addressDetails.placeId,
          } : undefined,
        },
        paymentMethod: activePayment,
        paymentDetails: {
          method: paymentData.method,
          transactionId: paymentData.paymentIntentId,
          status: 'paid',
          paidAt: new Date().toISOString(),
        },
        items: cartState.cartArray.map(item => ({
          productId: item.selectedProductId || item.id || item._id,
          name: item.name,
          price: item.price,
          quantity: item.quantity || 1,
          sizeId: item.selectedSizeId || null,
          subProductId: item.selectedSubProductId || null,
          tenantId: item.selectedVendorId || null,
        })),
        subtotal,
        shippingFee: shippingDisplay.cost,
        total: finalTotal,
        couponCode: appliedCouponCode || undefined,
        status: 'confirmed',
        paymentStatus: 'paid',
      };

      const response = await fetch(`${API_URL}/api/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(orderData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to create order');
      }

      clearCart();
      localStorage.removeItem('appliedCoupon');
      // Save customer email for order confirmation page (guest users)
      localStorage.setItem('customerEmail', formData.email);
      const orderId = data.data?.order?._id || data.data?.order?.id || data.order?._id || data.order?.id;
      router.push(`/order-confirmation?orderId=${orderId}`);
    } catch (err: any) {
      setError(err.message || 'Payment succeeded but order creation failed. Please contact support.');
      setIsLoading(false);
    }
  };

  const handlePaymentError = (errorMessage: string) => {
    setError(errorMessage);
    setShowPaymentModal(false);
  };

  if (!mounted) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      </div>
    );
  }

  if (cartState.cartArray.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center px-6">
          <Icon.PiShoppingCart size={64} className="mx-auto text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Your cart is empty</h2>
          <p className="text-gray-600 mb-6">Add some products to proceed to checkout.</p>
          <Link 
            href="/shop" 
            className="inline-block py-3 px-8 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800"
          >
            Start Shopping
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Progress Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <Link href="/cart" className="flex items-center gap-2 text-gray-600 hover:text-gray-900">
              <Icon.PiArrowLeft size={18} />
              <span className="font-medium">Back to Cart</span>
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white flex items-center justify-center text-xs font-bold">1</div>
                <span className="hidden sm:block text-gray-900">Cart</span>
              </div>
              <div className="w-8 h-0.5 bg-green-500" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold">2</div>
                <span className="hidden sm:block text-gray-900">Checkout</span>
              </div>
              <div className="w-8 h-0.5 bg-gray-300" />
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 flex items-center justify-center text-xs font-bold">3</div>
                <span className="hidden sm:block text-gray-400">Confirmation</span>
              </div>
            </div>
            <div className="w-24" />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <Icon.PiWarningCircle size={20} className="text-red-500" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <div className="flex flex-col lg:flex-row gap-6 max-w-6xl mx-auto">
            {/* Left Column - Forms */}
            <div className="lg:w-3/5 space-y-4">
              {/* Customer Information */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-900 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon.PiUser size={18} className="text-white" />
                    <h2 className="text-base font-semibold text-white">Customer Information</h2>
                  </div>
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InputField 
                      label="First Name" 
                      name="firstName" 
                      icon={Icon.PiUser}
                      value={formData.firstName}
                      error={errors.firstName}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                    <InputField 
                      label="Last Name" 
                      name="lastName" 
                      icon={Icon.PiUser}
                      value={formData.lastName}
                      error={errors.lastName}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                    <InputField 
                      label="Email" 
                      name="email" 
                      type="email" 
                      icon={Icon.PiEnvelope}
                      value={formData.email}
                      error={errors.email}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                    <InputField 
                      label="Phone" 
                      name="phone" 
                      type="tel" 
                      placeholder="+234" 
                      icon={Icon.PiPhone}
                      value={formData.phone}
                      error={errors.phone}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                  </div>
                </div>
              </div>

              {/* Shipping Address */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-800 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon.PiTruck size={18} className="text-white" />
                    <h2 className="text-base font-semibold text-white">Shipping Address</h2>
                  </div>
                </div>
                <div className="p-4 space-y-4">
                  <AddressAutocomplete
                    value={formData.address || ''}
                    onChange={handleAddressSelect}
                    onClearError={() => handleClearError('address')}
                    error={errors.address}
                    label="Street Address"
                    placeholder="Start typing your address..."
                  />
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <InputField 
                      label="City" 
                      name="city" 
                      icon={Icon.PiBuildings}
                      value={formData.city}
                      error={errors.city}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                    <InputField 
                      label="State" 
                      name="state" 
                      icon={Icon.PiMapTrifold}
                      value={formData.state}
                      error={errors.state}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                    <InputField 
                      label="ZIP Code" 
                      name="zipCode" 
                      icon={Icon.PiMailbox}
                      value={formData.zipCode}
                      error={errors.zipCode}
                      onChange={handleInputChange}
                      onClearError={handleClearError}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Country</label>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <Icon.PiGlobe size={18} />
                      </div>
                      <select
                        name="country"
                        value={formData.country}
                        onChange={handleInputChange}
                        className="w-full pl-10 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:border-gray-900 outline-none appearance-none bg-white"
                      >
                        <option value="Nigeria">Nigeria</option>
                        {/* <option value="Ghana">Ghana</option>
                        <option value="Kenya">Kenya</option>
                        <option value="South Africa">South Africa</option>
                        <option value="United States">United States</option>
                        <option value="United Kingdom">United Kingdom</option> */}
                      </select>
                      <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                        <Icon.PiCaretDown size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method */}
              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-700 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon.PiCreditCard size={18} className="text-white" />
                    <h2 className="text-base font-semibold text-white">Payment Method</h2>
                  </div>
                </div>
                <div className="p-4">
                  {showPaymentModal && paymentData?.method === 'stripe' && (
                    <div className="mb-4">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <p className="text-sm text-blue-800">
                          Enter your card details to complete payment
                        </p>
                      </div>
                      <PaymentHandler
                        clientSecret={paymentData.clientSecret}
                        amount={finalTotal}
                        onPaymentSuccess={handlePaymentSuccess}
                        onPaymentError={handlePaymentError}
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setShowPaymentModal(false);
                          setPaymentData(null);
                        }}
                        className="mt-3 w-full py-2 text-gray-600 hover:text-gray-900 text-sm"
                      >
                        ← Back to payment options
                      </button>
                    </div>
                  )}

                  {showPaymentModal && paymentData?.method === 'paystack' && (
                    <div className="text-center py-6">
                      <Icon.PiArrowRight size={32} className="mx-auto text-green-600 mb-2" />
                      <h3 className="text-lg font-semibold">Redirecting to Paystack</h3>
                    </div>
                  )}

                  {!showPaymentModal && (
                    <div className="space-y-2">
                      {paymentMethods.map((method) => {
                        const IconComponent = method.icon;
                        const isActive = activePayment === method.id;
                        return (
                          <label
                            key={method.id}
                            onClick={() => handlePayment(method.id)}
                            className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors
                              ${isActive 
                                ? 'border-gray-900 bg-gray-50' 
                                : 'border-gray-200 hover:border-gray-300'
                              }`}
                          >
                            <input
                              type="radio"
                              name="payment"
                              checked={isActive}
                              onChange={() => handlePayment(method.id)}
                              className="w-4 h-4"
                            />
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0
                              ${isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'}`}
                            >
                              <IconComponent size={20} />
                            </div>
                            <div className="flex-1">
                              <p className={`font-medium text-sm ${isActive ? 'text-gray-900' : 'text-gray-700'}`}>
                                {method.name}
                              </p>
                              <p className="text-xs text-gray-500">{method.description}</p>
                            </div>
                            {isActive && (
                              <div className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center">
                                <Icon.PiCheck size={12} weight="bold" />
                              </div>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:w-2/5">
              <div className="bg-white rounded-lg border border-gray-200 sticky top-4">
                <div className="bg-gray-900 px-4 py-3 border-b border-gray-200">
                  <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <Icon.PiShoppingCart size={18} />
                    Order Summary
                  </h2>
                  <p className="text-gray-400 text-xs mt-0.5">{cartState.cartArray.length} item(s)</p>
                </div>

                <div className="p-4">
                  {/* Cart Items */}
                  <div className="space-y-3 mb-4 max-h-56 overflow-y-auto">
                    {cartState.cartArray.map((item, index) => (
                      <div 
                        key={item.cartItemId}
                        className="flex items-center gap-3 p-2 rounded-lg bg-gray-50"
                      >
                        <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0 border border-gray-200">
                          {(item.thumbImage?.[0] || item.primaryImage?.url || item.images?.[0]?.url) ? (
                            <Image 
                              src={item.thumbImage?.[0] || item.primaryImage?.url || item.images?.[0]?.url} 
                              alt={item.name} 
                              width={56} 
                              height={56} 
                              className="w-full h-full object-cover" 
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-gray-100">
                              <Icon.PiImage size={16} className="text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm text-gray-900 truncate">{item.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {item.selectedVendor && (
                              <span className="text-xs text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded">
                                {item.selectedVendor}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              Qty: {item.quantity || 1}
                            </span>
                            {item.selectedSize && (
                              <span className="text-xs text-gray-500">
                                {item.selectedSize}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="font-semibold text-sm text-gray-900">₦{(item.price * (item.quantity || 1)).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>

                  {/* Coupon */}
                  <div className="mb-4">
                    <CouponComponent
                      onCouponApplied={handleCouponApplied}
                      onCouponRemoved={handleCouponRemoved}
                      cartItems={cartState.cartArray}
                      subtotal={subtotal}
                      shipping={shipping}
                    />
                  </div>

                  {/* Price Breakdown */}
                  <div className="space-y-2 mb-4 text-sm">
                    <div className="flex justify-between text-gray-600 py-1">
                      <span>Subtotal</span>
                      <span className="font-medium">₦{subtotal.toLocaleString()}</span>
                    </div>
                    
                    {couponDiscount > 0 && (
                      <div className="flex justify-between text-green-600 py-1">
                        <span>Discount</span>
                        <span className="font-medium">-₦{couponDiscount.toLocaleString()}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-gray-600 py-1">
                      <span>Shipping</span>
                      <span className={`font-medium ${shippingDisplay.cost === 0 ? 'text-green-600' : ''}`}>
                        {shippingDisplay.text}
                      </span>
                    </div>
                  </div>

                  {/* Total */}
                  <div className="border-t border-gray-200 pt-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-gray-900">Total</span>
                      <span className="text-xl font-bold text-gray-900">₦{finalTotal.toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Submit Button */}
                  {!showPaymentModal && (
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="w-full py-3 px-4 bg-gray-900 text-white font-semibold rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {isLoading ? (
                        <>
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Icon.PiLockKey size={18} />
                          {activePayment === 'cod' ? 'Place Order' : `Pay ₦${finalTotal.toLocaleString()}`}
                        </>
                      )}
                    </button>
                  )}

                  {/* Security Note */}
                  <div className="mt-3 flex items-center justify-center gap-3 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Icon.PiShieldCheck size={14} className="text-green-500" />
                      <span>Secure</span>
                    </div>
                    <div className="w-1 h-1 rounded-full bg-gray-300" />
                    <div className="flex items-center gap-1">
                      <Icon.PiLockKey size={14} className="text-blue-500" />
                      <span>Encrypted</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </form>
      </div>
    </>
  );
};

export default Checkout;
