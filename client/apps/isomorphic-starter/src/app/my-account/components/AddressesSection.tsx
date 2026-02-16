'use client';

import React from 'react';
import * as Icon from 'react-icons/pi';

interface Address {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode?: string;
  country: string;
  landmark?: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
}

interface AddressesSectionProps {
  addresses: Address[];
  onAddAddress: () => void;
  onEditAddress: (address: Address) => void;
  onDeleteAddress: (addressId: string) => void;
  onSetDefault: (addressId: string, type: 'shipping' | 'billing') => void;
}

const AddressesSection: React.FC<AddressesSectionProps> = ({
  addresses,
  onAddAddress,
  onEditAddress,
  onDeleteAddress,
  onSetDefault,
}) => {
  const getLabelColor = (label: string) => {
    const colors: Record<string, string> = {
      home: 'bg-blue-100 text-blue-700',
      work: 'bg-purple-100 text-purple-700',
      office: 'bg-indigo-100 text-indigo-700',
      other: 'bg-gray-100 text-gray-700',
    };
    return colors[label.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const formatAddress = (address: Address) => {
    const parts = [
      address.addressLine1,
      address.addressLine2,
      `${address.city}, ${address.state} ${address.postalCode || ''}`.trim(),
      address.country,
    ].filter(Boolean);
    return parts.join(', ');
  };

  const handleMapClick = (address: Address) => {
    const query = encodeURIComponent(formatAddress(address));
    window.open(`https://maps.google.com/?q=${query}`, '_blank');
  };

  if (addresses.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Addresses</h1>
            <p className="text-gray-500 mt-1">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</p>
          </div>
          <button
            onClick={onAddAddress}
            className="px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium flex items-center gap-2 shadow-lg hover:shadow-xl"
          >
            <Icon.PiPlus size={18} /> Add Address
          </button>
        </div>

        <div className="bg-white rounded-3xl p-12 text-center shadow-sm border border-gray-100">
          <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
            <Icon.PiMapPin size={48} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">No Addresses Yet</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Add an address to make checkout faster and easier. Your saved addresses will appear here.
          </p>
          <button
            onClick={onAddAddress}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium shadow-lg hover:shadow-xl"
          >
            <Icon.PiPlus size={20} /> Add Your First Address
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Addresses</h1>
          <p className="text-gray-500 mt-1">{addresses.length} address{addresses.length !== 1 ? 'es' : ''}</p>
        </div>
        <button
          onClick={onAddAddress}
          className="px-4 py-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 transition-all font-medium flex items-center gap-2 shadow-lg hover:shadow-xl"
        >
          <Icon.PiPlus size={18} /> Add Address
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {addresses.map((address) => (
          <div
            key={address._id}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all group"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {address.isDefaultShipping && (
                    <span className="px-2.5 py-1 bg-gray-900 text-white text-xs font-bold rounded-full flex items-center gap-1">
                      <Icon.PiCheckCircle size={12} /> Default Shipping
                    </span>
                  )}
                  {address.isDefaultBilling && !address.isDefaultShipping && (
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full flex items-center gap-1">
                      <Icon.PiCheckCircle size={12} /> Default Billing
                    </span>
                  )}
                  <span className={`px-2.5 py-1 text-xs font-semibold rounded-full capitalize ${getLabelColor(address.label)}`}>
                    {address.label}
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => onEditAddress(address)}
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                    title="Edit"
                  >
                    <Icon.PiPencil size={16} />
                  </button>
                  <button
                    onClick={() => onDeleteAddress(address._id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete"
                  >
                    <Icon.PiTrash size={16} />
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-gray-900 text-lg">{address.fullName}</p>
                <p className="text-gray-600">{address.addressLine1}</p>
                {address.addressLine2 && <p className="text-gray-600">{address.addressLine2}</p>}
                <p className="text-gray-600">
                  {address.city}, {address.state} {address.postalCode}
                </p>
                <p className="text-gray-600">{address.country}</p>
              </div>

              {address.landmark && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <p className="text-sm text-gray-500">
                    <span className="font-medium">Landmark:</span> {address.landmark}
                  </p>
                </div>
              )}

              <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-500">
                  <Icon.PiPhone size={14} />
                  <span className="text-sm">{address.phone}</span>
                </div>
                <button
                  onClick={() => handleMapClick(address)}
                  className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                >
                  <Icon.PiMapPin size={14} /> View Map
                </button>
              </div>
            </div>

            <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
              {!address.isDefaultShipping && (
                <button
                  onClick={() => onSetDefault(address._id, 'shipping')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors flex items-center gap-1"
                >
                  <Icon.PiCheckCircle size={14} /> Set as Default Shipping
                </button>
              )}
              {!address.isDefaultBilling && !address.isDefaultShipping && (
                <button
                  onClick={() => onSetDefault(address._id, 'billing')}
                  className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors flex items-center gap-1"
                >
                  <Icon.PiCheckCircle size={14} /> Set as Default Billing
                </button>
              )}
              {(address.isDefaultShipping || address.isDefaultBilling) && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Icon.PiCheckCircle size={14} /> Default Set
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AddressesSection;
