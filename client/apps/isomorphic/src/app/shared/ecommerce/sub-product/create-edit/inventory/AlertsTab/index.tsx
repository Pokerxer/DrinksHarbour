'use client';

import { Text, Input, Switch } from 'rizzui';
import { motion } from 'framer-motion';
import { PiWarning, PiCube, PiArrowCounterClockwise } from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import type { AlertSettings } from '../shared/types';

interface AlertsTabProps {
  availableStock: number;
  lowStockThreshold: number;
  reorderPoint: number;
  daysUntilStockout: number;
  recommendedOrderQty: number;
  dailySalesRate: number;
  onDailySalesRateChange: (rate: number) => void;
  alertSettings: AlertSettings;
  onAlertSettingsChange: (settings: AlertSettings) => void;
}

export function AlertsTab({
  availableStock,
  lowStockThreshold,
  reorderPoint,
  daysUntilStockout,
  recommendedOrderQty,
  dailySalesRate,
  onDailySalesRateChange,
  alertSettings,
  onAlertSettingsChange,
}: AlertsTabProps) {
  const updateSetting = (key: keyof AlertSettings, value: any) => {
    onAlertSettingsChange({ ...alertSettings, [key]: value });
  };

  return (
    <motion.div variants={fieldStaggerVariants} className="space-y-6">
      <Text className="mb-4 text-lg font-semibold">Stock Alerts</Text>

      {/* Alert Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Low Stock Alert */}
        <div
          className={`rounded-xl border p-5 ${
            availableStock <= lowStockThreshold && availableStock > 0
              ? 'border-amber-200 bg-amber-50'
              : 'border-green-200 bg-green-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                availableStock <= lowStockThreshold && availableStock > 0
                  ? 'bg-amber-100'
                  : 'bg-green-100'
              }`}
            >
              <PiWarning
                className={`h-5 w-5 ${
                  availableStock <= lowStockThreshold && availableStock > 0
                    ? 'text-amber-600'
                    : 'text-green-600'
                }`}
              />
            </div>
            <div>
              <Text className="font-medium">Low Stock Alert</Text>
              <Text className="text-sm text-gray-500">
                {availableStock <= lowStockThreshold && availableStock > 0
                  ? `Below threshold (${availableStock}/${lowStockThreshold})`
                  : 'Stock levels OK'}
              </Text>
            </div>
          </div>
        </div>

        {/* Out of Stock Alert */}
        <div
          className={`rounded-xl border p-5 ${
            availableStock === 0 ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                availableStock === 0 ? 'bg-red-100' : 'bg-green-100'
              }`}
            >
              <PiCube
                className={`h-5 w-5 ${availableStock === 0 ? 'text-red-600' : 'text-green-600'}`}
              />
            </div>
            <div>
              <Text className="font-medium">Out of Stock</Text>
              <Text className="text-sm text-gray-500">
                {availableStock === 0 ? 'No stock available' : 'Stock available'}
              </Text>
            </div>
          </div>
        </div>

        {/* Reorder Alert */}
        <div
          className={`rounded-xl border p-5 ${
            availableStock <= reorderPoint
              ? 'border-blue-200 bg-blue-50'
              : 'border-green-200 bg-green-50'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full ${
                availableStock <= reorderPoint ? 'bg-blue-100' : 'bg-green-100'
              }`}
            >
              <PiArrowCounterClockwise
                className={`h-5 w-5 ${
                  availableStock <= reorderPoint ? 'text-blue-600' : 'text-green-600'
                }`}
              />
            </div>
            <div>
              <Text className="font-medium">Reorder Alert</Text>
              <Text className="text-sm text-gray-500">
                {availableStock <= reorderPoint
                  ? `Below reorder point (${reorderPoint})`
                  : 'Reorder level OK'}
              </Text>
            </div>
          </div>
        </div>
      </div>

      {/* Alert Configuration */}
      <div className="rounded-xl border border-gray-200 p-6">
        <Text className="mb-4 font-semibold">Alert Settings</Text>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">Low Stock Alerts</Text>
                <Text className="text-xs text-gray-500">Notify when stock falls below threshold</Text>
              </div>
              <Switch
                checked={alertSettings.lowStockEnabled}
                onChange={(checked) => updateSetting('lowStockEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">Out of Stock Alerts</Text>
                <Text className="text-xs text-gray-500">Notify when stock reaches zero</Text>
              </div>
              <Switch
                checked={alertSettings.outOfStockEnabled}
                onChange={(checked) => updateSetting('outOfStockEnabled', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">Reorder Point Alerts</Text>
                <Text className="text-xs text-gray-500">Notify when reorder point is reached</Text>
              </div>
              <Switch
                checked={alertSettings.reorderEnabled}
                onChange={(checked) => updateSetting('reorderEnabled', checked)}
              />
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">Email Notifications</Text>
                <Text className="text-xs text-gray-500">Receive alerts via email</Text>
              </div>
              <Switch
                checked={alertSettings.emailNotifications}
                onChange={(checked) => updateSetting('emailNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">In-App Notifications</Text>
                <Text className="text-xs text-gray-500">Show alerts in the dashboard</Text>
              </div>
              <Switch
                checked={alertSettings.inAppNotifications}
                onChange={(checked) => updateSetting('inAppNotifications', checked)}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
              <div>
                <Text className="font-medium text-gray-700">SMS Notifications</Text>
                <Text className="text-xs text-gray-500">Receive alerts via SMS</Text>
              </div>
              <Switch
                checked={alertSettings.smsNotifications}
                onChange={(checked) => updateSetting('smsNotifications', checked)}
              />
            </div>
          </div>
        </div>

        {/* Email Input */}
        {alertSettings.emailNotifications && (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Notification Emails
            </label>
            <Input
              placeholder="email@example.com, another@example.com"
              value={alertSettings.notifyEmails}
              onChange={(e) => updateSetting('notifyEmails', e.target.value)}
              className="w-full md:w-96"
            />
          </div>
        )}

        {/* Alert Frequency */}
        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Alert Frequency</label>
          <select
            value={alertSettings.alertFrequency}
            onChange={(e) => updateSetting('alertFrequency', e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 md:w-64"
          >
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
            <option value="weekly">Weekly Summary</option>
          </select>
        </div>
      </div>

      {/* Forecast Settings */}
      <div className="rounded-xl border border-gray-200 p-6">
        <Text className="mb-4 font-semibold">Stock Forecasting</Text>
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-gray-700">
              Estimated Daily Sales Rate
            </label>
            <Input
              type="number"
              min="0"
              value={dailySalesRate}
              onChange={(e) => onDailySalesRateChange(parseInt(e.target.value) || 0)}
              className="w-full md:w-48"
            />
            <Text className="mt-1 text-xs text-gray-500">Average units sold per day</Text>
          </div>
          <div className="flex-1">
            <Text className="mb-1.5 block text-sm font-medium text-gray-700">
              Days Until Stockout
            </Text>
            <Text
              className={`text-lg font-bold ${
                daysUntilStockout < 7
                  ? 'text-red-600'
                  : daysUntilStockout < 30
                  ? 'text-amber-600'
                  : 'text-green-600'
              }`}
            >
              {daysUntilStockout === Infinity ? '\u221E' : daysUntilStockout} days
            </Text>
          </div>
          <div className="flex-1">
            <Text className="mb-1.5 block text-sm font-medium text-gray-700">Recommended Order</Text>
            <Text className="text-lg font-bold text-blue-600">{recommendedOrderQty} units</Text>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
