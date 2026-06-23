// @ts-nocheck
'use client';

import { Controller, useFormContext } from 'react-hook-form';
import { Text, Badge } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiCheckCircleFill,
  PiGlobe,
  PiClock,
  PiStorefront,
  PiShoppingCart,
  PiCalendarCheck,
  PiMapPin,
  PiTruck,
} from 'react-icons/pi';
import cn from '@core/utils/class-names';

const availability = [
  {
    value: 'online',
    name: 'Available Online',
    description: 'Customers can purchase through the website',
    icon: PiGlobe,
    color: 'from-green-400 to-emerald-500',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-300',
    textColor: 'text-green-700',
    badge: 'Live',
    badgeColor: 'success',
  },
  {
    value: 'coming-soon',
    name: 'Coming Soon',
    description: 'Product will be available for pre-order',
    icon: PiClock,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    badge: 'Upcoming',
    badgeColor: 'warning',
  },
  {
    value: 'offline',
    name: 'In-Store Only',
    description: 'Only available at physical locations',
    icon: PiStorefront,
    color: 'from-blue-400 to-indigo-500',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-300',
    textColor: 'text-blue-700',
    badge: 'In-Store',
    badgeColor: 'info',
  },
  {
    value: 'pre-order',
    name: 'Pre-Order',
    description: 'Accept orders before official release',
    icon: PiCalendarCheck,
    color: 'from-purple-400 to-violet-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    badge: 'Pre-Order',
    badgeColor: 'secondary',
  },
  {
    value: 'pickup',
    name: 'Pickup Only',
    description: 'Order online and collect from store',
    icon: PiMapPin,
    color: 'from-cyan-400 to-teal-500',
    bgColor: 'bg-cyan-50',
    borderColor: 'border-cyan-300',
    textColor: 'text-cyan-700',
    badge: 'Click & Collect',
    badgeColor: 'info',
  },
  {
    value: 'delivery',
    name: 'Delivery Only',
    description: 'Available for home delivery only',
    icon: PiTruck,
    color: 'from-rose-400 to-pink-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    badge: 'Delivery',
    badgeColor: 'danger',
  },
];

export default function ProductAvailability() {
  const { control, watch } = useFormContext();
  const currentValue = watch('productAvailability');

  const selectedOption = availability.find((item) => item.value === currentValue);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="col-span-full space-y-6"
    >
      {/* Header with current selection */}
      <div className="relative overflow-hidden rounded-xl border-l-4 border-teal-500 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-4">
        <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-teal-100/50" />
        <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-cyan-100/50" />
        
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500 text-white shadow-lg">
              <PiShoppingCart className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-semibold text-gray-900">Availability Status</Text>
              <Text className="text-xs text-gray-500">
                Define how customers can access this product
              </Text>
            </div>
          </div>
          
          <AnimatePresence mode="wait">
            {selectedOption && (
              <motion.div
                key={selectedOption.value}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="flex items-center gap-2"
              >
                <Badge variant="flat" color={selectedOption.badgeColor as any} className="font-medium">
                  {selectedOption.badge}
                </Badge>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Availability Options Grid */}
      <Controller
        name="productAvailability"
        control={control}
        render={({ field: { value, onChange } }) => (
          <div className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            {availability.map((item, index) => {
              const Icon = item.icon;
              const isSelected = value === item.value;
              
              return (
                <motion.button
                  key={item.value}
                  type="button"
                  onClick={() => onChange(item.value)}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative overflow-hidden rounded-xl border-2 p-4 text-left transition-all',
                    isSelected
                      ? `${item.borderColor} ${item.bgColor} shadow-lg`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-md'
                  )}
                >
                  {/* Gradient Background when selected */}
                  {isSelected && (
                    <motion.div
                      layoutId="availability-bg"
                      className={cn(
                        'absolute inset-0 bg-gradient-to-br opacity-10',
                        item.color
                      )}
                    />
                  )}

                  {/* Floating elements */}
                  <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-gray-100/50" />
                  
                  <div className="relative flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-md transition-all',
                        isSelected
                          ? `bg-gradient-to-br ${item.color} text-white`
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-6 w-6" />
                    </div>

                    {/* Content */}
                    <div className="flex-grow">
                      <div className="flex items-center gap-2">
                        <Text
                          className={cn(
                            'font-semibold transition-colors',
                            isSelected ? item.textColor : 'text-gray-800'
                          )}
                        >
                          {item.name}
                        </Text>
                        {isSelected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className={cn('rounded-full p-0.5', item.bgColor)}
                          >
                            <PiCheckCircleFill className={cn('h-4 w-4', item.textColor)} />
                          </motion.div>
                        )}
                      </div>
                      <Text className="mt-0.5 text-xs text-gray-500">
                        {item.description}
                      </Text>
                    </div>
                  </div>

                  {/* Selection indicator bar */}
                  <AnimatePresence>
                    {isSelected && (
                      <motion.div
                        initial={{ scaleX: 0 }}
                        animate={{ scaleX: 1 }}
                        exit={{ scaleX: 0 }}
                        className={cn(
                          'absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r',
                          item.color
                        )}
                      />
                    )}
                  </AnimatePresence>
                </motion.button>
              );
            })}
          </div>
        )}
      />

      {/* Selected Option Details */}
      <AnimatePresence mode="wait">
        {selectedOption && (
          <motion.div
            key={selectedOption.value}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={cn(
              'rounded-xl border p-4',
              selectedOption.borderColor,
              selectedOption.bgColor
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                  selectedOption.color
                )}
              >
                <selectedOption.icon className="h-4 w-4" />
              </div>
              <div>
                <Text className={cn('font-medium', selectedOption.textColor)}>
                  {selectedOption.name} Selected
                </Text>
                <Text className="text-xs text-gray-500">
                  {selectedOption.description}
                </Text>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
