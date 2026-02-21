// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button } from 'rizzui';
import { motion } from 'framer-motion';
import { 
  PiEye, PiStar, PiSparkle, PiCrown, PiCalendar, PiClock, PiCheckCircle,
  PiWarningCircle, PiPauseCircle, PiTrash, PiPlayCircle, PiEyeSlash,
  PiArrowsClockwise, PiStorefront, PiBinoculars, PiPushPin
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants } from './animations';

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'gray', description: 'Work in progress', icon: PiPauseCircle },
  { value: 'pending', label: 'Pending', color: 'warning', description: 'Awaiting approval', icon: PiClock },
  { value: 'active', label: 'Active', color: 'success', description: 'Live and visible', icon: PiCheckCircle },
  { value: 'low_stock', label: 'Low Stock', color: 'warning', description: 'Running low', icon: PiWarningCircle },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'danger', description: 'Not available', icon: PiTrash },
  { value: 'discontinued', label: 'Discontinued', color: 'secondary', description: 'No longer sold', icon: PiTrash },
  { value: 'hidden', label: 'Hidden', color: 'gray', description: 'Not visible', icon: PiEyeSlash },
  { value: 'archived', label: 'Archived', color: 'gray', description: 'Archived', icon: PiArrowsClockwise },
];

export default function SubProductStatusVisibility() {
  const methods = useFormContext();
  const register = methods?.register;
  const watch = methods?.watch;
  const setValue = methods?.setValue;
  const control = methods?.control;
  const errors = methods?.formState?.errors || {};

  const status = watch?.('subProductData.status') || 'draft';
  const isFeaturedByTenant = watch?.('subProductData.isFeaturedByTenant');
  const isNewArrival = watch?.('subProductData.isNewArrival');
  const isBestSeller = watch?.('subProductData.isBestSeller');
  const isPublished = watch?.('subProductData.isPublished');
  const visibleInPOS = watch?.('subProductData.visibleInPOS') ?? true;
  const visibleInOnlineStore = watch?.('subProductData.visibleInOnlineStore') ?? true;

  const [showAdvanced, setShowAdvanced] = useState(false);

  const currentStatus = STATUS_OPTIONS.find(s => s.value === status) || STATUS_OPTIONS[0];
  const StatusIcon = currentStatus.icon;

  const handleStatusChange = (newStatus: string) => {
    setValue?.('subProductData.status', newStatus, { shouldValidate: true });
    
    // Auto-set activation date when activating
    if (newStatus === 'active' && status !== 'active') {
      setValue?.('subProductData.activatedAt', new Date().toISOString().slice(0, 16));
      setValue?.('subProductData.isPublished', true);
    }
    
    // Clear deactivation date when reactivating
    if (newStatus === 'active' && (status === 'hidden' || status === 'archived')) {
      setValue?.('subProductData.deactivatedAt', '');
    }
  };

  const handleQuickActions = (action: string) => {
    switch (action) {
      case 'publish':
        handleStatusChange('active');
        break;
      case 'unpublish':
        handleStatusChange('hidden');
        break;
      case 'discontinue':
        handleStatusChange('discontinued');
        setValue?.('subProductData.discontinuedAt', new Date().toISOString().slice(0, 16));
        break;
      case 'archive':
        handleStatusChange('archived');
        break;
      case 'restore':
        handleStatusChange('draft');
        break;
    }
  };

  return (
    <motion.div 
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={fieldStaggerVariants} custom={0}>
        <Text className="mb-2 text-lg font-semibold">Status & Visibility</Text>
        <Text className="text-sm text-gray-500">
          Control the visibility and featured status of this sub-product
        </Text>
      </motion.div>

      {/* Status Overview Card */}
      <motion.div 
        variants={fieldStaggerVariants}
        className={`rounded-lg border p-4 ${
          status === 'active' 
            ? 'border-green-200 bg-green-50' 
            : status === 'hidden' || status === 'archived'
            ? 'border-gray-200 bg-gray-50'
            : 'border-blue-200 bg-blue-50'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${
              status === 'active' 
                ? 'bg-green-100' 
                : 'bg-gray-100'
            }`}>
              <StatusIcon className={`h-6 w-6 ${
                status === 'active' ? 'text-green-600' : 'text-gray-600'
              }`} />
            </div>
            <div>
              <Text className="text-lg font-semibold">{currentStatus.label}</Text>
              <Text className="text-sm text-gray-500">{currentStatus.description}</Text>
            </div>
          </div>
          <Badge color={currentStatus.color as any} className="text-sm">
            {currentStatus.label}
          </Badge>
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
        <div className="flex flex-wrap gap-2">
          {status !== 'active' && (
            <Button
              type="button"
              variant="solid"
              size="sm"
              onClick={() => handleQuickActions('publish')}
            >
              <PiPlayCircle className="mr-1 h-4 w-4" />
              Publish Now
            </Button>
          )}
          {status === 'active' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickActions('unpublish')}
            >
              <PiEyeSlash className="mr-1 h-4 w-4" />
              Unpublish
            </Button>
          )}
          {status !== 'discontinued' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickActions('discontinue')}
            >
              <PiTrash className="mr-1 h-4 w-4" />
              Discontinue
            </Button>
          )}
          {status === 'archived' && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleQuickActions('restore')}
            >
              <PiArrowsClockwise className="mr-1 h-4 w-4" />
              Restore
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            <PiCalendar className="mr-1 h-4 w-4" />
            {showAdvanced ? 'Hide' : 'Schedule'}
          </Button>
        </div>
      </motion.div>

      {/* Status Selection */}
      <motion.div variants={fieldStaggerVariants} custom={1}>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Status
        </label>
        <Controller
          name="subProductData.status"
          control={control}
          render={({ field }) => (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {STATUS_OPTIONS.map((option) => {
                const OptionIcon = option.icon;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleStatusChange(option.value)}
                    className={`flex flex-col items-center gap-1 rounded-lg border p-3 transition-all ${
                      field.value === option.value
                        ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <OptionIcon className={`h-5 w-5 ${
                      field.value === option.value ? 'text-blue-600' : 'text-gray-500'
                    }`} />
                    <span className={`text-xs font-medium ${
                      field.value === option.value ? 'text-blue-700' : 'text-gray-600'
                    }`}>
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        />
      </motion.div>

      {/* Advanced Scheduling */}
      {showAdvanced && (
        <motion.div 
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4 rounded-lg border border-gray-200 bg-gray-50 p-4"
        >
          <Text className="font-medium">Scheduling</Text>
          
          <div className="grid gap-6 md:grid-cols-3">
            {/* Activated At */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Activated At
              </label>
              <div className="relative">
                <Input
                  type="datetime-local"
                  {...register('subProductData.activatedAt')}
                  className="w-full pl-9"
                />
                <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <Text className="mt-1 text-xs text-gray-500">
                When product became active
              </Text>
            </div>

            {/* Deactivated At */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Deactivate At
              </label>
              <div className="relative">
                <Input
                  type="datetime-local"
                  {...register('subProductData.deactivatedAt')}
                  className="w-full pl-9"
                />
                <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <Text className="mt-1 text-xs text-gray-500">
                When to hide automatically
              </Text>
            </div>

            {/* Discontinued At */}
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                Discontinued At
              </label>
              <div className="relative">
                <Input
                  type="datetime-local"
                  {...register('subProductData.discontinuedAt')}
                  className="w-full pl-9"
                />
                <PiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
              <Text className="mt-1 text-xs text-gray-500">
                When product was discontinued
              </Text>
            </div>
          </div>
        </motion.div>
      )}

      {/* Featured Toggles */}
      <motion.div 
        variants={fieldStaggerVariants} 
        custom={3}
        className="space-y-4 rounded-lg border border-gray-200 p-4"
      >
        <Text className="font-medium">Featured Options</Text>

        {/* Featured by Tenant */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-50">
              <PiStar className="h-4 w-4 text-purple-500" />
            </div>
            <div>
              <Text className="font-medium">Featured by Tenant</Text>
              <Text className="text-sm text-gray-500">
                Highlight in featured sections on your store
              </Text>
            </div>
          </div>
          <Switch
            checked={isFeaturedByTenant}
            onChange={(checked) => setValue('subProductData.isFeaturedByTenant', checked)}
          />
        </motion.div>

        {/* New Arrival */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50">
              <PiSparkle className="h-4 w-4 text-blue-500" />
            </div>
            <div>
              <Text className="font-medium">New Arrival</Text>
              <Text className="text-sm text-gray-500">
                Show in new arrivals section
              </Text>
            </div>
          </div>
          <Switch
            checked={isNewArrival}
            onChange={(checked) => setValue('subProductData.isNewArrival', checked)}
          />
        </motion.div>

        {/* Best Seller */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50">
              <PiCrown className="h-4 w-4 text-amber-500" />
            </div>
            <div>
              <Text className="font-medium">Best Seller</Text>
              <Text className="text-sm text-gray-500">
                Mark as a best seller product
              </Text>
            </div>
          </div>
          <Switch
            checked={isBestSeller}
            onChange={(checked) => setValue('subProductData.isBestSeller', checked)}
          />
        </motion.div>

        {/* Visible on Main Site */}
        <motion.div 
          variants={itemVariants}
          className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-gray-50"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50">
              <PiEye className="h-4 w-4 text-green-500" />
            </div>
            <div>
              <Text className="font-medium">Visible on Main Site</Text>
              <Text className="text-sm text-gray-500">
                Show on drinksharbour.com marketplace
              </Text>
            </div>
          </div>
          <Switch
            checked={isPublished}
            onChange={(checked) => setValue('subProductData.isPublished', checked)}
          />
        </motion.div>
      </motion.div>

      {/* Tenant-specific visibility */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg border border-gray-200 p-4"
      >
        <div className="flex items-center gap-2 mb-4">
          <PiStorefront className="h-5 w-5 text-gray-500" />
          <Text className="font-medium">Tenant Store Visibility</Text>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2">
          {/* Show in POS */}
          <motion.div 
            variants={itemVariants}
            className="flex items-center justify-between rounded-lg p-3 border border-gray-100"
          >
            <div>
              <Text className="font-medium text-sm">Visible in POS</Text>
              <Text className="text-xs text-gray-500">Show in point of sale</Text>
            </div>
            <Switch
              checked={visibleInPOS}
              onChange={(checked) => setValue('subProductData.visibleInPOS', checked)}
            />
          </motion.div>

          {/* Show in Online Store */}
          <motion.div 
            variants={itemVariants}
            className="flex items-center justify-between rounded-lg p-3 border border-gray-100"
          >
            <div>
              <Text className="font-medium text-sm">Visible in Online Store</Text>
              <Text className="text-xs text-gray-500">Show in online store</Text>
            </div>
            <Switch
              checked={visibleInOnlineStore}
              onChange={(checked) => setValue('subProductData.visibleInOnlineStore', checked)}
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
