// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useFormContext, Controller } from 'react-hook-form';
import { Input, Text, Switch, Badge, Button } from 'rizzui';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PiEye, PiStar, PiSparkle, PiCrown, PiCalendar, PiClock, PiCheckCircle,
  PiWarningCircle, PiPauseCircle, PiTrash, PiPlayCircle, PiEyeSlash,
  PiArrowsClockwise, PiStorefront, PiBinoculars, PiPushPin, PiBell,
  PiLightning, PiChartLine, PiHeart, PiArchive
} from 'react-icons/pi';
import { fieldStaggerVariants, containerVariants, itemVariants, toggleVariants } from './animations';

// Animation variants
const statusCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    transition: { delay: i * 0.05, duration: 0.3 }
  }),
  hover: { scale: 1.02, transition: { duration: 0.2 } }
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'gray', description: 'Work in progress', icon: PiPauseCircle, bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  { value: 'pending', label: 'Pending', color: 'warning', description: 'Awaiting approval', icon: PiClock, bg: 'bg-amber-100', text: 'text-amber-600', border: 'border-amber-200' },
  { value: 'active', label: 'Active', color: 'success', description: 'Live and visible', icon: PiCheckCircle, bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' },
  { value: 'low_stock', label: 'Low Stock', color: 'warning', description: 'Running low', icon: PiWarningCircle, bg: 'bg-orange-100', text: 'text-orange-600', border: 'border-orange-200' },
  { value: 'out_of_stock', label: 'Out of Stock', color: 'danger', description: 'Not available', icon: PiTrash, bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' },
  { value: 'discontinued', label: 'Discontinued', color: 'secondary', description: 'No longer sold', icon: PiTrash, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' },
  { value: 'hidden', label: 'Hidden', color: 'gray', description: 'Not visible', icon: PiEyeSlash, bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' },
  { value: 'archived', label: 'Archived', color: 'gray', description: 'Archived', icon: PiArrowsClockwise, bg: 'bg-slate-100', text: 'text-slate-500', border: 'border-slate-200' },
];

// Status flow for visual progress
const STATUS_FLOW = ['draft', 'pending', 'active', 'low_stock', 'out_of_stock', 'discontinued', 'hidden', 'archived'];

const flowStepColors: Record<string, string> = {
  draft: 'bg-gray-400',
  pending: 'bg-amber-400',
  active: 'bg-green-500',
  low_stock: 'bg-orange-400',
  out_of_stock: 'bg-red-400',
  discontinued: 'bg-slate-400',
  hidden: 'bg-gray-400',
  archived: 'bg-slate-500',
};

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

      {/* Status Flow Visualization */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg border border-gray-200 p-4"
      >
        <Text className="mb-4 font-medium">Status Flow</Text>
        <div className="flex items-center justify-between overflow-x-auto pb-2">
          {STATUS_FLOW.map((flowStatus, index) => {
            const flowOption = STATUS_OPTIONS.find(s => s.value === flowStatus);
            const FlowIcon = flowOption?.icon || PiPauseCircle;
            const isCurrentStatus = status === flowStatus;
            const statusIndex = STATUS_FLOW.indexOf(status);
            const isPast = statusIndex > index;
            const isFuture = statusIndex < index;
            
            return (
              <div key={flowStatus} className="flex items-center">
                <motion.button
                  type="button"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => handleStatusChange(flowStatus)}
                  className={`group relative flex flex-col items-center gap-1 rounded-lg p-2 transition-all ${
                    isCurrentStatus 
                      ? 'scale-110 z-10' 
                      : 'hover:scale-105'
                  }`}
                >
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                    isCurrentStatus 
                      ? `${flowStepColors[flowStatus]} ring-4 ring-offset-2 ${flowStepColors[flowStatus].replace('bg-', 'ring-')}`
                      : isPast 
                        ? 'bg-gray-300'
                        : isFuture 
                          ? 'bg-gray-100 border border-gray-200'
                          : 'bg-gray-200'
                  }`}>
                    <FlowIcon className={`h-5 w-5 ${
                      isCurrentStatus || isPast ? 'text-white' : 'text-gray-400'
                    }`} />
                  </div>
                  <span className={`text-[10px] font-medium whitespace-nowrap ${
                    isCurrentStatus ? 'text-gray-900' : 'text-gray-500'
                  }`}>
                    {flowOption?.label}
                  </span>
                  {isCurrentStatus && (
                    <motion.div
                      layoutId="statusIndicator"
                      className="absolute -bottom-1 h-1 rounded-full bg-current"
                      style={{ width: '60%' }}
                    />
                  )}
                </motion.button>
                {index < STATUS_FLOW.length - 1 && (
                  <div className={`mx-1 h-0.5 w-4 md:w-8 ${
                    isPast ? 'bg-gray-300' : 'bg-gray-100'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={fieldStaggerVariants}>
        <Text className="mb-3 text-sm font-medium text-gray-700">Quick Actions</Text>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant={status === 'active' ? 'outline' : 'solid'}
            size="sm"
            onClick={() => handleStatusChange(status === 'active' ? 'hidden' : 'active')}
          >
            {status === 'active' ? (
              <>
                <PiEyeSlash className="mr-1 h-4 w-4" />
                Unpublish
              </>
            ) : (
              <>
                <PiPlayCircle className="mr-1 h-4 w-4" />
                Publish
              </>
            )}
          </Button>
          <Button
            type="button"
            variant={status === 'discontinued' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(status === 'discontinued' ? 'active' : 'discontinued')}
          >
            {status === 'discontinued' ? (
              <>
                <PiArrowsClockwise className="mr-1 h-4 w-4" />
                Reactivate
              </>
            ) : (
              <>
                <PiTrash className="mr-1 h-4 w-4" />
                Discontinue
              </>
            )}
          </Button>
          <Button
            type="button"
            variant={status === 'archived' ? 'solid' : 'outline'}
            size="sm"
            onClick={() => handleStatusChange(status === 'archived' ? 'draft' : 'archived')}
          >
            {status === 'archived' ? (
              <>
                <PiArrowsClockwise className="mr-1 h-4 w-4" />
                Restore
              </>
            ) : (
              <>
                <PiArchive className="mr-1 h-4 w-4" />
                Archive
              </>
            )}
          </Button>
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

      {/* Status History Summary */}
      <motion.div 
        variants={fieldStaggerVariants}
        className="rounded-lg border border-gray-200 p-4"
      >
        <Text className="mb-4 font-medium">Status Timeline</Text>
        <div className="space-y-3">
          {status === 'active' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-green-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <PiCheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Product is Live</Text>
                <Text className="text-xs text-gray-500">Visible to customers</Text>
              </div>
              <Badge color="success" variant="flat">Active</Badge>
            </motion.div>
          )}
          {status === 'hidden' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-gray-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100">
                <PiEyeSlash className="h-4 w-4 text-gray-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Product is Hidden</Text>
                <Text className="text-xs text-gray-500">Not visible to customers</Text>
              </div>
              <Badge color="gray" variant="flat">Hidden</Badge>
            </motion.div>
          )}
          {status === 'out_of_stock' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-red-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                <PiWarningCircle className="h-4 w-4 text-red-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Out of Stock Alert</Text>
                <Text className="text-xs text-gray-500">Restock to enable sales</Text>
              </div>
              <Badge color="danger" variant="flat">Out of Stock</Badge>
            </motion.div>
          )}
          {status === 'low_stock' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-orange-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                <PiBell className="h-4 w-4 text-orange-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Low Stock Warning</Text>
                <Text className="text-xs text-gray-500">Consider reordering soon</Text>
              </div>
              <Badge color="warning" variant="flat">Low Stock</Badge>
            </motion.div>
          )}
          {status === 'discontinued' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-slate-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                <PiTrash className="h-4 w-4 text-slate-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Product Discontinued</Text>
                <Text className="text-xs text-gray-500">No longer available for sale</Text>
              </div>
              <Badge color="gray" variant="flat">Discontinued</Badge>
            </motion.div>
          )}
          {status === 'draft' && (
            <motion.div 
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg bg-blue-50 p-3"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                <PiPauseCircle className="h-4 w-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <Text className="text-sm font-medium">Draft Mode</Text>
                <Text className="text-xs text-gray-500">Complete setup to publish</Text>
              </div>
              <Badge color="info" variant="flat">Draft</Badge>
            </motion.div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
