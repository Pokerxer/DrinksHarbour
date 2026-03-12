'use client';

import { Text, Input } from 'rizzui';
import { motion } from 'framer-motion';
import { Controller, useFormContext } from 'react-hook-form';
import { fieldStaggerVariants } from '../../animations';
import { TRACKING_OPTIONS, ROUTE_OPTIONS, VALUATION_METHODS, getTrackingIcon, getRouteIcon } from '../shared/constants';

interface SettingsTabProps {
  tracking: string;
  valuation: string;
  routes: string[];
  standardPrice: number;
  costPrice: number;
  onToggleRoute: (route: string) => void;
  onStandardPriceChange: (price: number) => void;
}

export function SettingsTab({
  tracking,
  valuation,
  routes,
  standardPrice,
  costPrice,
  onToggleRoute,
  onStandardPriceChange,
}: SettingsTabProps) {
  const { control } = useFormContext();

  return (
    <motion.div variants={fieldStaggerVariants} className="space-y-6">
      {/* Inventory Tracking */}
      <div className="rounded-xl border border-gray-200 p-6">
        <Text className="mb-4 font-semibold">Inventory Tracking</Text>
        <Controller
          name="subProductData.tracking"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="grid gap-4 md:grid-cols-3">
              {TRACKING_OPTIONS.map((option) => {
                const IconComponent = getTrackingIcon(option.iconName);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    className={`rounded-lg border-2 p-4 text-left transition-all ${
                      value === option.value
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <IconComponent
                        className={`h-6 w-6 ${
                          value === option.value ? 'text-blue-600' : 'text-gray-500'
                        }`}
                      />
                      <Text className="font-medium">{option.label}</Text>
                    </div>
                    <Text className="mt-1 text-xs text-gray-500">{option.description}</Text>
                  </button>
                );
              })}
            </div>
          )}
        />
      </div>

      {/* Product Routes */}
      <div className="rounded-xl border border-gray-200 p-6">
        <Text className="mb-4 font-semibold">Product Routes</Text>
        <div className="grid gap-4 md:grid-cols-2">
          {ROUTE_OPTIONS.map((route) => {
            const IconComponent = getRouteIcon(route.iconName);
            const isSelected = (routes || []).includes(route.value);
            return (
              <button
                key={route.value}
                type="button"
                onClick={() => onToggleRoute(route.value)}
                className={`rounded-lg border-2 p-4 text-left transition-all ${
                  isSelected
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <IconComponent
                    className={`h-6 w-6 ${isSelected ? 'text-green-600' : 'text-gray-500'}`}
                  />
                  <Text className="font-medium">{route.label}</Text>
                </div>
                <Text className="mt-1 text-xs text-gray-500">{route.description}</Text>
              </button>
            );
          })}
        </div>
      </div>

      {/* Valuation */}
      <div className="rounded-xl border border-gray-200 p-6">
        <Text className="mb-4 font-semibold">Inventory Valuation</Text>
        <Controller
          name="subProductData.valuation"
          control={control}
          render={({ field: { onChange, value } }) => (
            <div className="grid gap-4 md:grid-cols-3">
              {VALUATION_METHODS.map((method) => (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => onChange(method.value)}
                  className={`rounded-lg border-2 p-4 text-left transition-all ${
                    value === method.value
                      ? 'border-purple-500 bg-purple-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <Text className="font-medium">{method.label}</Text>
                  <Text className="mt-1 text-xs text-gray-500">{method.description}</Text>
                </button>
              ))}
            </div>
          )}
        />
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          <Input
            type="number"
            label="Standard Price"
            value={standardPrice || costPrice}
            onChange={(e) => onStandardPriceChange(parseFloat(e.target.value) || 0)}
            placeholder="0.00"
          />
          <Input
            type="text"
            label="Costing Method"
            value={valuation?.toUpperCase() || 'FIFO'}
            disabled
          />
        </div>
      </div>
    </motion.div>
  );
}
