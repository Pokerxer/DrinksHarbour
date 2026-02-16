'use client';

import React from 'react';
import Image from 'next/image';
import * as Icon from 'react-icons/pi';

interface Vendor {
  tenant: {
    _id: string;
    name: string;
    city?: string;
    logo?: { url: string };
  };
  rating?: number;
  reviewCount?: number;
}

interface VendorSelectorProps {
  vendors: Vendor[];
  selectedVendor: Vendor | null;
  onSelect: (vendorId: string) => void;
};
const VENDOR_PALETTE = [
  '#1a1a2e',
  '#16213e',
  '#0f3460',
  '#533483',
  '#e94560',
  '#2c3e50',
  '#6b2d5b',
  '#1b4332',
  '#b8860b',
  '#3d405b',
];

function vendorPaletteIndex(name: string): number {
return name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % VENDOR_PALETTE.length;
}

function getInitials(name: string): string {
const skip = new Set(['the', 'a', 'an']);
  const words = name
    .replace(/[^a-zA-Z\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !skip.has(w.toLowerCase()));
  if (!words.length);
return name.charAt(0).toUpperCase();
  return words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
};
const VendorSelector: React.FC<VendorSelectorProps> = React.memo(
  ({ vendors, selectedVendor, onSelect }) => {
if (vendors.length <= 1);
return null;

    return (
<div className="vendor-selector">
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-semibold text-gray-900">Select Seller</label>
          {selectedVendor && (
            <span className="text-sm text-gray-600">
              {selectedVendor.tenant.name}
              {selectedVendor.tenant.city && ` • ${selectedVendor.tenant.city}`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-3">
          {vendors.map((vendor) => {
const isActive = selectedVendor?.tenant._id === vendor.tenant._id;
            const bg = VENDOR_PALETTE[vendorPaletteIndex(vendor.tenant.name)];

            return (
<button
                key={vendor.tenant._id}
                onClick={() => onSelect(vendor.tenant._id)}
                className={`relative group flex items-center gap-3 px-4 py-2 rounded-xl border-2 transition-all duration-200 ${
                  isActive
                    ? 'border-black bg-gray-50 shadow-md'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {/* Vendor Avatar */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold ${
                    isActive ? 'ring-2 ring-black ring-offset-2' : ''
                  }`}
                  style={{ backgroundColor: bg }}
                >
                  {vendor.tenant.logo?.url ? (
                    <Image
                      src={vendor.tenant.logo.url}
                      alt={vendor.tenant.name}
                      width={40}
                      height={40}
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    getInitials(vendor.tenant.name)
                  )}
                </div>

                {/* Vendor Info */}
                <div className="text-left">
                  <div className="text-sm font-semibold text-gray-900">{vendor.tenant.name}</div>
                  {vendor.rating && (
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <Icon.PiStarFill size={12} className="text-amber-400" />
                      <span>{vendor.rating.toFixed(1)}</span>
                      <span>({vendor.reviewCount || 0})</span>
                    </div>
                  )}
                </div>

                {/* Selected Indicator */}
                {isActive && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                    <Icon.PiCheckBold size={12} className="text-white" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);

VendorSelector.displayName = 'VendorSelector';

export default VendorSelector;
