'use client';

import React, { useState, useEffect, useCallback } from 'react';
import * as Icon from 'react-icons/pi';

interface CartItem {
  _id: string;
  cartItemId: string;
  name: string;
  price: number;
  quantity: number;
  selectedVendor?: string;
  selectedSize?: string;
}

interface CouponProps {
  onCouponApplied: (code: string, discount: number, couponData?: any) => void;
  onCouponRemoved: () => void;
  cartItems: CartItem[];
  subtotal: number;
  shipping: number;
}

interface AppliedCoupon {
  code: string;
  name: string;
  discountType: string;
  discountValue: number;
  discount: number;
}

interface AvailableCoupon {
  code: string;
  name: string;
  description?: string;
  discountType: string;
  discountValue: number;
  minimumPurchase?: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';

const formatPrice = (price: number): string => {
  return '₦' + price.toLocaleString();
};

const getDiscountLabel = (type: string, value: number): string => {
  switch (type) {
    case 'percentage':
      return `${value}% OFF`;
    case 'fixed_amount':
      return `₦${value} OFF`;
    case 'free_shipping':
      return 'Free Shipping';
    default:
      return 'Discount';
  }
};

const Coupon: React.FC<CouponProps> = ({
  onCouponApplied,
  onCouponRemoved,
  cartItems,
  subtotal,
  shipping
}) => {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<AvailableCoupon[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    const savedCoupon = localStorage.getItem('appliedCoupon');
    if (savedCoupon) {
      try {
        const parsed = JSON.parse(savedCoupon);
        if (parsed && parsed.code) {
          setAppliedCoupon(parsed);
          onCouponApplied(parsed.code, parsed.discount || 0);
        }
      } catch (e) {
        localStorage.removeItem('appliedCoupon');
      }
    }
  }, [onCouponApplied]);

  const fetchAvailableCoupons = useCallback(async () => {
    if (subtotal <= 0) return;

    try {
      const token = localStorage.getItem('token') || sessionStorage.getItem('token');

      const cartData = {
        items: cartItems.map(item => ({
          productId: item._id || item.cartItemId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        subtotal,
        tenant: cartItems[0]?.selectedVendor || null,
      };

      const response = await fetch(`${API_URL}/api/coupons/auto-apply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({ cartData }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Auto-apply error:', errorData);
        return;
      }

      const data = await response.json().catch(() => ({ data: [] }));

      if (data && data.data && Array.isArray(data.data)) {
        const coupons = data.data
          .filter((item: any) => item && item.coupon && item.coupon.code)
          .filter((item: any) => !appliedCoupon || item.coupon.code !== appliedCoupon.code)
          .map((item: any) => ({
            code: item.coupon.code || '',
            name: item.coupon.name || item.coupon.code || '',
            description: item.coupon.description,
            discountType: item.coupon.discountType || 'percentage',
            discountValue: item.coupon.discountValue || 0,
            minimumPurchase: item.coupon.minimumPurchaseAmount,
          }));
        setAvailableCoupons(coupons);
      }
    } catch (error) {
      console.error('Failed to fetch available coupons:', error);
    }
  }, [cartItems, subtotal, appliedCoupon, API_URL]);

  useEffect(() => {
    if (subtotal > 0 && !appliedCoupon) {
      fetchAvailableCoupons();
    }
  }, [subtotal, appliedCoupon, fetchAvailableCoupons]);

  const validateCoupon = async (code: string): Promise<AppliedCoupon | null> => {
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    const cartData = {
      items: cartItems.map(item => ({
        productId: item._id || item.cartItemId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      subtotal,
      tenant: cartItems[0]?.selectedVendor || null,
    };

    const response = await fetch(`${API_URL}/api/coupons/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
      body: JSON.stringify({ code: code.trim().toUpperCase(), cartData }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Invalid coupon code');
    }

    const responseData = await response.json().catch(() => ({}));
    
    // API returns { success: true, data: { coupon, discount } }
    const data = responseData.data || responseData;

    if (!data || !data.coupon) {
      throw new Error('Invalid coupon response');
    }

    return {
      code: data.coupon.code || '',
      name: data.coupon.name || data.coupon.code || '',
      discountType: data.coupon.discountType || 'percentage',
      discountValue: data.coupon.discountValue || 0,
      discount: data.discount || 0,
    };
  };

  const handleApplyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setIsLoading(true);
    setCouponError('');

    try {
      const coupon = await validateCoupon(couponCode);

      if (coupon) {
        setAppliedCoupon(coupon);
        localStorage.setItem('appliedCoupon', JSON.stringify(coupon));
        onCouponApplied(coupon.code, coupon.discount, coupon);
        setCouponCode('');
        setAvailableCoupons([]);
        setIsExpanded(false);
      }
    } catch (error: any) {
      setCouponError(error.message || 'Invalid coupon code');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    localStorage.removeItem('appliedCoupon');
    onCouponRemoved();
    fetchAvailableCoupons();
  };

  const handleUseAvailableCoupon = async (coupon: AvailableCoupon) => {
    setIsLoading(true);
    setCouponError('');

    try {
      const validatedCoupon = await validateCoupon(coupon.code);

      if (validatedCoupon) {
        setAppliedCoupon(validatedCoupon);
        localStorage.setItem('appliedCoupon', JSON.stringify(validatedCoupon));
        onCouponApplied(validatedCoupon.code, validatedCoupon.discount, validatedCoupon);
        setCouponCode('');
        setAvailableCoupons([]);
        setIsExpanded(false);
      }
    } catch (error: any) {
      setCouponError(error.message || 'Failed to apply coupon');
    } finally {
      setIsLoading(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="mb-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <Icon.PiCheck size={20} className="text-green-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-green-700">{appliedCoupon.code}</span>
                <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
                  {getDiscountLabel(appliedCoupon.discountType, appliedCoupon.discountValue)}
                </span>
              </div>
              <span className="text-xs text-green-600">You save {formatPrice(appliedCoupon.discount)}</span>
            </div>
          </div>
          <button
            onClick={handleRemoveCoupon}
            className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1 rounded-lg hover:bg-white transition-colors flex items-center gap-1"
          >
            <Icon.PiX size={14} />
            Remove
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      <button
        type="button"
        className="flex items-center justify-between w-full cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="text-sm font-medium text-gray-700">Have a coupon?</span>
        <Icon.PiCaretDown
          size={16}
          className={`text-gray-500 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
        />
      </button>

      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                placeholder="Enter coupon code"
                disabled={isLoading}
                onKeyDown={(e) => e.key === 'Enter' && handleApplyCoupon()}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
              />
            </div>
            <button
              onClick={handleApplyCoupon}
              disabled={isLoading}
              className="px-5 py-3 bg-gray-900 text-white font-medium rounded-xl hover:bg-gray-800 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                'Apply'
              )}
            </button>
          </div>

          {couponError && (
            <div className="text-sm text-red-500 flex items-center gap-1">
              <Icon.PiWarningCircle size={16} />
              {couponError}
            </div>
          )}

          {availableCoupons.length > 0 && !couponError && (
            <div className="pt-2">
              <p className="text-xs font-medium text-gray-500 mb-2">Available for your cart:</p>
              <div className="space-y-2">
                {availableCoupons.map((coupon) => (
                  <button
                    key={coupon.code}
                    onClick={() => handleUseAvailableCoupon(coupon)}
                    disabled={isLoading}
                    className="w-full p-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl hover:from-orange-100 hover:to-amber-100 transition-colors text-left"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-semibold text-gray-800">{coupon.code}</span>
                        {coupon.description && (
                          <p className="text-xs text-gray-500 mt-0.5">{coupon.description}</p>
                        )}
                      </div>
                      <span className="text-sm font-bold text-orange-600">
                        {getDiscountLabel(coupon.discountType, coupon.discountValue)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Coupon;
