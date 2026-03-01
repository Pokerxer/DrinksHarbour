// @ts-nocheck
'use client';

import { useState } from 'react';
import FormGroup from '@/app/shared/form-group';
import { Switch, Input, Text, Badge } from 'rizzui';
import cn from '@core/utils/class-names';
import { DatePicker } from '@core/ui/datepicker';
import { Controller, useFormContext } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PiCalendar,
  PiCalendarCheck,
  PiCalendarX,
  PiClock,
  PiGift,
  PiWine,
  PiParty,
  PiHeart,
  PiStar,
  PiCheckCircle,
  PiInfo,
  PiCaretRight,
} from 'react-icons/pi';

// Date range presets for beverage delivery
const datePresets = [
  {
    id: 'next-week',
    label: 'Next Week',
    icon: PiClock,
    color: 'bg-blue-500',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setDate(end.getDate() + 7);
      return { start, end };
    },
  },
  {
    id: 'two-weeks',
    label: '2 Weeks',
    icon: PiCalendar,
    color: 'bg-purple-500',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setDate(end.getDate() + 14);
      return { start, end };
    },
  },
  {
    id: 'month',
    label: '1 Month',
    icon: PiCalendarCheck,
    color: 'bg-green-500',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 1);
      return { start, end };
    },
  },
  {
    id: 'quarter',
    label: '3 Months',
    icon: PiCalendarCheck,
    color: 'bg-amber-500',
    getDates: () => {
      const start = new Date();
      start.setDate(start.getDate() + 1);
      const end = new Date();
      end.setMonth(end.getMonth() + 3);
      return { start, end };
    },
  },
];

// Event type presets
const eventPresets = [
  {
    id: 'party',
    label: 'Party/Event',
    icon: PiParty,
    color: 'from-pink-400 to-rose-500',
    bgColor: 'bg-pink-50',
    borderColor: 'border-pink-300',
    textColor: 'text-pink-700',
    fieldName: 'Event Date',
  },
  {
    id: 'wedding',
    label: 'Wedding',
    icon: PiHeart,
    color: 'from-rose-400 to-red-500',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-300',
    textColor: 'text-rose-700',
    fieldName: 'Wedding Date',
  },
  {
    id: 'gift',
    label: 'Gift Delivery',
    icon: PiGift,
    color: 'from-purple-400 to-violet-500',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-300',
    textColor: 'text-purple-700',
    fieldName: 'Delivery Date',
  },
  {
    id: 'tasting',
    label: 'Wine Tasting',
    icon: PiWine,
    color: 'from-amber-400 to-orange-500',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-300',
    textColor: 'text-amber-700',
    fieldName: 'Tasting Date',
  },
  {
    id: 'special',
    label: 'Special Occasion',
    icon: PiStar,
    color: 'from-indigo-400 to-blue-500',
    bgColor: 'bg-indigo-50',
    borderColor: 'border-indigo-300',
    textColor: 'text-indigo-700',
    fieldName: 'Occasion Date',
  },
];

export default function DeliveryEvent({ className }: { className?: string }) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useFormContext();

  const [selectedEventType, setSelectedEventType] = useState<string | null>(null);
  
  const requiresDate = watch('isPurchaseSpecifyDate');
  const limitDate = watch('isLimitDate');
  const availableDate = watch('availableDate');
  const endDate = watch('endDate');
  const fieldName = watch('dateFieldName');

  const applyDatePreset = (presetId: string) => {
    const preset = datePresets.find((p) => p.id === presetId);
    if (preset) {
      const { start, end } = preset.getDates();
      setValue('availableDate', start);
      setValue('endDate', end);
      setValue('isLimitDate', true);
    }
  };

  const applyEventPreset = (event: typeof eventPresets[0]) => {
    setSelectedEventType(event.id);
    setValue('dateFieldName', event.fieldName);
    setValue('isPurchaseSpecifyDate', true);
  };

  // Calculate days between dates
  const getDaysBetween = () => {
    if (availableDate && endDate) {
      const diffTime = Math.abs(new Date(endDate).getTime() - new Date(availableDate).getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    }
    return 0;
  };

  return (
    <FormGroup
      title="Delivery / Event Date"
      description="Configure date requirements for orders"
      className={cn(className)}
    >
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="col-span-full space-y-6"
      >
        {/* Header */}
        <div className="relative overflow-hidden rounded-xl border-l-4 border-violet-500 bg-gradient-to-r from-violet-50 via-white to-purple-50 p-4">
          <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-violet-100/50" />
          <div className="absolute -bottom-4 right-12 h-16 w-16 rounded-full bg-purple-100/50" />
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 text-white shadow-lg">
                <PiCalendar className="h-5 w-5" />
              </div>
              <div>
                <Text className="font-semibold text-gray-900">Event & Delivery Dates</Text>
                <Text className="text-xs text-gray-500">
                  Set date requirements for customer orders
                </Text>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {requiresDate && (
                <Badge variant="flat" color="primary" className="font-medium">
                  Date Required
                </Badge>
              )}
              {limitDate && availableDate && endDate && (
                <Badge variant="flat" color="success" className="font-medium">
                  {getDaysBetween()} Days
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Event Type Presets */}
        <div className="space-y-3">
          <Text className="text-sm font-medium text-gray-700">Quick Setup by Event Type</Text>
          <div className="grid gap-2 @lg:grid-cols-3 @xl:grid-cols-5">
            {eventPresets.map((event) => {
              const Icon = event.icon;
              const isSelected = selectedEventType === event.id;
              
              return (
                <motion.button
                  key={event.id}
                  type="button"
                  onClick={() => applyEventPreset(event)}
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  className={cn(
                    'relative overflow-hidden rounded-xl border-2 p-3 text-left transition-all',
                    isSelected
                      ? `${event.borderColor} ${event.bgColor} shadow-md`
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        'flex h-8 w-8 items-center justify-center rounded-lg shadow-sm transition-all',
                        isSelected
                          ? `bg-gradient-to-br ${event.color} text-white`
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <Text
                      className={cn(
                        'text-sm font-medium transition-colors',
                        isSelected ? event.textColor : 'text-gray-700'
                      )}
                    >
                      {event.label}
                    </Text>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Require Date Toggle */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={cn(
            'flex items-center justify-between rounded-xl border p-4 transition-all',
            requiresDate
              ? 'border-violet-300 bg-violet-50'
              : 'border-gray-200 bg-white hover:border-violet-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              requiresDate ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              <PiCalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-medium text-gray-800">Require Date Selection</Text>
              <Text className="text-xs text-gray-500">Customers must specify a date to purchase</Text>
            </div>
          </div>
          <Controller
            name="isPurchaseSpecifyDate"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Switch
                checked={value || false}
                onChange={(e) => onChange(e.target.checked)}
              />
            )}
          />
        </motion.div>

        {/* Date Field Name */}
        <AnimatePresence>
          {requiresDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-gray-200 bg-white p-4">
                <Text className="mb-3 text-sm font-medium text-gray-700">
                  Date Field Label
                </Text>
                <Input
                  placeholder="e.g., Delivery Date, Event Date, Wedding Date"
                  className="w-full"
                  prefix={<PiCalendar className="h-4 w-4 text-gray-400" />}
                  {...register('dateFieldName')}
                  error={errors.dateFieldName?.message as string}
                />
                <Text className="mt-2 text-xs text-gray-500">
                  This label will be shown to customers when selecting their date
                </Text>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Limit Date Range Toggle */}
        <motion.div
          whileHover={{ scale: 1.01 }}
          className={cn(
            'flex items-center justify-between rounded-xl border p-4 transition-all',
            limitDate
              ? 'border-amber-300 bg-amber-50'
              : 'border-gray-200 bg-white hover:border-amber-200'
          )}
        >
          <div className="flex items-center gap-3">
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-lg',
              limitDate ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
            )}>
              <PiCalendarX className="h-5 w-5" />
            </div>
            <div>
              <Text className="font-medium text-gray-800">Limit Date Range</Text>
              <Text className="text-xs text-gray-500">Restrict available dates for selection</Text>
            </div>
          </div>
          <Controller
            name="isLimitDate"
            control={control}
            render={({ field: { value, onChange } }) => (
              <Switch
                checked={value || false}
                onChange={(e) => onChange(e.target.checked)}
              />
            )}
          />
        </motion.div>

        {/* Date Range Configuration */}
        <AnimatePresence>
          {limitDate && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-4 overflow-hidden"
            >
              {/* Quick Date Presets */}
              <div className="space-y-3">
                <Text className="text-sm font-medium text-gray-700">Quick Date Ranges</Text>
                <div className="flex flex-wrap gap-2">
                  {datePresets.map((preset) => {
                    const Icon = preset.icon;
                    return (
                      <motion.button
                        key={preset.id}
                        type="button"
                        onClick={() => applyDatePreset(preset.id)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-all hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                      >
                        <div className={cn('flex h-6 w-6 items-center justify-center rounded-md text-white', preset.color)}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        {preset.label}
                      </motion.button>
                    );
                  })}
                </div>
              </div>

              {/* Date Pickers */}
              <div className="grid gap-4 @lg:grid-cols-2">
                {/* Start Date */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-100">
                      <PiCalendarCheck className="h-4 w-4 text-green-600" />
                    </div>
                    <div>
                      <Text className="text-sm font-medium text-gray-700">Start Date</Text>
                      <Text className="text-xs text-gray-500">Earliest available date</Text>
                    </div>
                  </div>
                  <Controller
                    name="availableDate"
                    control={control}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <DatePicker
                        inputProps={{ label: '' }}
                        placeholderText="Select start date"
                        dateFormat="dd/MM/yyyy"
                        onChange={onChange}
                        onBlur={onBlur}
                        selected={value}
                        minDate={new Date()}
                      />
                    )}
                  />
                </div>

                {/* End Date */}
                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100">
                      <PiCalendarX className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <Text className="text-sm font-medium text-gray-700">End Date</Text>
                      <Text className="text-xs text-gray-500">Last available date</Text>
                    </div>
                  </div>
                  <Controller
                    name="endDate"
                    control={control}
                    render={({ field: { value, onChange, onBlur } }) => (
                      <DatePicker
                        inputProps={{ label: '' }}
                        placeholderText="Select end date"
                        dateFormat="dd/MM/yyyy"
                        onChange={onChange}
                        onBlur={onBlur}
                        selected={value}
                        minDate={availableDate || new Date()}
                      />
                    )}
                  />
                </div>
              </div>

              {/* Date Range Summary */}
              {availableDate && endDate && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-violet-200 bg-violet-50 p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500 text-white">
                      <PiCheckCircle className="h-5 w-5" />
                    </div>
                    <div className="flex-grow">
                      <Text className="font-medium text-violet-700">Date Range Configured</Text>
                      <div className="mt-1 flex items-center gap-2 text-sm text-violet-600">
                        <span>{new Date(availableDate).toLocaleDateString()}</span>
                        <PiCaretRight className="h-4 w-4" />
                        <span>{new Date(endDate).toLocaleDateString()}</span>
                        <Badge variant="flat" color="primary" size="sm" className="ml-2">
                          {getDaysBetween()} days
                        </Badge>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Info Card */}
        <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm">
          <PiInfo className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
          <div>
            <Text className="font-medium text-blue-800">When to use date requirements</Text>
            <Text className="text-xs text-blue-700">
              Enable date selection for event-specific products like wedding wines, 
              party supplies, gift deliveries, or any product that needs to arrive on a specific date.
            </Text>
          </div>
        </div>
      </motion.div>
    </FormGroup>
  );
}
