'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { Text, Badge, Button, Input, Select, Switch, Modal } from 'rizzui';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  PiPlus,
  PiPencil,
  PiTrash,
  PiPlayCircle,
  PiPauseCircle,
  PiLightning,
  PiSpinner,
  PiWarning,
  PiCheckCircle,
} from 'react-icons/pi';
import { fieldStaggerVariants } from '../../animations';
import { reorderService, type ReorderRule, type ReorderSuggestion } from '@/services/reorder.service';

interface RulesTabProps {
  subProductId: string | undefined;
  totalStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  lowStockThreshold: number;
}

export function RulesTab({
  subProductId,
  totalStock,
  reorderPoint,
  reorderQuantity,
  lowStockThreshold,
}: RulesTabProps) {
  const { data: session } = useSession();
  
  // State
  const [rules, setRules] = useState<ReorderRule[]>([]);
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRule, setEditingRule] = useState<ReorderRule | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    triggerType: 'reorder_point',
    reorderPoint: reorderPoint || 10,
    orderQuantity: reorderQuantity || 50,
    leadTimeDays: 7,
    vendorName: '',
    isAutomatic: false,
    notifyOnTrigger: true,
    checkFrequency: 'daily',
  });

  // Fetch rules
  const fetchRules = useCallback(async () => {
    if (!session?.user?.token || !subProductId) return;
    
    setIsLoading(true);
    try {
      const response = await reorderService.getRules(session.user.token, {
        subProductId,
        limit: 50,
      });
      
      if (response.success) {
        setRules(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch reorder rules:', error);
    } finally {
      setIsLoading(false);
    }
  }, [session?.user?.token, subProductId]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    if (!session?.user?.token) return;
    
    try {
      const response = await reorderService.getSuggestions(session.user.token);
      
      if (response.success) {
        setSuggestions(response.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  }, [session?.user?.token]);

  useEffect(() => {
    fetchRules();
    fetchSuggestions();
  }, [fetchRules, fetchSuggestions]);

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      triggerType: 'reorder_point',
      reorderPoint: reorderPoint || 10,
      orderQuantity: reorderQuantity || 50,
      leadTimeDays: 7,
      vendorName: '',
      isAutomatic: false,
      notifyOnTrigger: true,
      checkFrequency: 'daily',
    });
    setEditingRule(null);
  };

  // Create rule
  const handleCreateRule = async () => {
    if (!session?.user?.token || !subProductId) return;
    if (!formData.name.trim()) {
      toast.error('Please enter a rule name');
      return;
    }
    
    try {
      await reorderService.createRule({
        subProductId,
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType,
        reorderPoint: formData.reorderPoint,
        orderQuantity: formData.orderQuantity,
        leadTimeDays: formData.leadTimeDays,
        vendorName: formData.vendorName,
        isAutomatic: formData.isAutomatic,
        notifyOnTrigger: formData.notifyOnTrigger,
        checkFrequency: formData.checkFrequency,
      }, session.user.token);
      
      toast.success('Reorder rule created');
      setShowCreateModal(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to create rule');
    }
  };

  // Update rule
  const handleUpdateRule = async () => {
    if (!session?.user?.token || !editingRule) return;
    
    try {
      await reorderService.updateRule(editingRule._id, {
        name: formData.name,
        description: formData.description,
        triggerType: formData.triggerType,
        reorderPoint: formData.reorderPoint,
        orderQuantity: formData.orderQuantity,
        leadTimeDays: formData.leadTimeDays,
        vendorName: formData.vendorName,
        isAutomatic: formData.isAutomatic,
        notifyOnTrigger: formData.notifyOnTrigger,
        checkFrequency: formData.checkFrequency,
      }, session.user.token);
      
      toast.success('Reorder rule updated');
      setShowCreateModal(false);
      resetForm();
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rule');
    }
  };

  // Delete rule
  const handleDeleteRule = async (ruleId: string) => {
    if (!session?.user?.token) return;
    
    if (!confirm('Are you sure you want to delete this rule?')) return;
    
    try {
      await reorderService.deleteRule(ruleId, session.user.token);
      toast.success('Reorder rule deleted');
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete rule');
    }
  };

  // Toggle rule status
  const handleToggleStatus = async (rule: ReorderRule) => {
    if (!session?.user?.token) return;
    
    try {
      await reorderService.updateRule(rule._id, {
        status: rule.status === 'active' ? 'paused' : 'active',
      }, session.user.token);
      
      toast.success(`Rule ${rule.status === 'active' ? 'paused' : 'activated'}`);
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to update rule');
    }
  };

  // Trigger rule manually
  const handleTriggerRule = async (ruleId: string) => {
    if (!session?.user?.token) return;
    
    try {
      await reorderService.triggerRule(ruleId, session.user.token, 'Manual trigger');
      toast.success('Rule triggered successfully');
      fetchRules();
    } catch (error: any) {
      toast.error(error.message || 'Failed to trigger rule');
    }
  };

  // Edit rule
  const handleEditRule = (rule: ReorderRule) => {
    setEditingRule(rule);
    setFormData({
      name: rule.name,
      description: rule.description || '',
      triggerType: rule.triggerType,
      reorderPoint: rule.reorderPoint,
      orderQuantity: rule.orderQuantity,
      leadTimeDays: rule.leadTimeDays,
      vendorName: rule.vendorName || '',
      isAutomatic: rule.isAutomatic,
      notifyOnTrigger: rule.notifyOnTrigger,
      checkFrequency: rule.checkFrequency,
    });
    setShowCreateModal(true);
  };

  // Get urgency color
  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'critical':
        return 'danger';
      case 'high':
        return 'warning';
      default:
        return 'info';
    }
  };

  // Check if current product needs reorder
  const needsReorder = totalStock <= reorderPoint;

  return (
    <motion.div variants={fieldStaggerVariants} className="space-y-6">
      {/* Current Status Alert */}
      {needsReorder && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl"
        >
          <PiWarning className="h-6 w-6 text-amber-500" />
          <div className="flex-1">
            <Text className="font-semibold text-amber-800">Reorder Recommended</Text>
            <Text className="text-sm text-amber-600">
              Current stock ({totalStock}) is at or below reorder point ({reorderPoint})
            </Text>
          </div>
          <Badge color="warning">Suggested: {reorderQuantity} units</Badge>
        </motion.div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Text className="font-semibold text-lg">Reordering Rules</Text>
          <Text className="text-sm text-gray-500">
            Automate stock replenishment when inventory runs low
          </Text>
        </div>
        <Button onClick={() => { resetForm(); setShowCreateModal(true); }}>
          <PiPlus className="mr-1 h-4 w-4" /> Add Rule
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <PiSpinner className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )}

      {/* Rules Table */}
      {!isLoading && rules.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Rule Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Trigger</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Reorder Point</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Order Qty</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Lead Time</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule._id} className="border-t border-gray-200 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Text className="font-medium">{rule.name}</Text>
                    {rule.description && (
                      <Text className="text-xs text-gray-500">{rule.description}</Text>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="flat" color="primary">
                      {rule.triggerType.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">{rule.reorderPoint}</td>
                  <td className="px-4 py-3 text-right">{rule.orderQuantity}</td>
                  <td className="px-4 py-3 text-right">{rule.leadTimeDays} days</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggleStatus(rule)}>
                      <Badge color={rule.status === 'active' ? 'success' : 'secondary'}>
                        {rule.status}
                      </Badge>
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => handleTriggerRule(rule._id)}
                        title="Trigger Now"
                      >
                        <PiLightning className="h-4 w-4 text-amber-500" />
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => handleEditRule(rule)}
                        title="Edit"
                      >
                        <PiPencil className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => handleDeleteRule(rule._id)}
                        title="Delete"
                      >
                        <PiTrash className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && rules.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-300 p-12 text-center">
          <PiPlayCircle className="mx-auto h-12 w-12 text-gray-300" />
          <Text className="mt-4 text-gray-500 font-medium">No reordering rules configured</Text>
          <Text className="text-sm text-gray-400 mt-1">
            Add rules to automate stock replenishment when inventory runs low
          </Text>
          <Button className="mt-4" onClick={() => { resetForm(); setShowCreateModal(true); }}>
            <PiPlus className="mr-1 h-4 w-4" /> Create First Rule
          </Button>
        </div>
      )}

      {/* Suggestions Section */}
      {suggestions.length > 0 && (
        <div className="mt-8">
          <Text className="font-semibold text-lg mb-4">Reorder Suggestions</Text>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {suggestions.slice(0, 6).map((suggestion) => (
              <motion.div
                key={suggestion.subProductId}
                className="p-4 rounded-xl border border-gray-200 bg-white hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <Text className="font-medium text-sm">{suggestion.sku}</Text>
                  <Badge color={getUrgencyColor(suggestion.urgency)} size="sm">
                    {suggestion.urgency}
                  </Badge>
                </div>
                <div className="space-y-1 text-sm text-gray-600">
                  <div className="flex justify-between">
                    <span>Current Stock:</span>
                    <span className="font-medium">{suggestion.currentStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suggested Order:</span>
                    <span className="font-medium text-blue-600">{suggestion.suggestedQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Cost:</span>
                    <span className="font-medium">{suggestion.estimatedCost.toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => { setShowCreateModal(false); resetForm(); }}
      >
        <div className="p-6 max-w-lg">
          <Text className="text-xl font-semibold mb-4">
            {editingRule ? 'Edit Reorder Rule' : 'Create Reorder Rule'}
          </Text>
          
          <div className="space-y-4">
            <Input
              label="Rule Name"
              placeholder="e.g., Low Stock Alert"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
            
            <Input
              label="Description (optional)"
              placeholder="Describe when this rule should trigger"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            
            <Select
              label="Trigger Type"
              options={[
                { label: 'Reorder Point', value: 'reorder_point' },
                { label: 'Minimum Quantity', value: 'min_quantity' },
                { label: 'Days of Stock', value: 'days_of_stock' },
                { label: 'Manual Only', value: 'manual' },
              ]}
              value={formData.triggerType}
              onChange={(option: any) => setFormData({ ...formData, triggerType: option.value })}
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Reorder Point"
                type="number"
                min={0}
                value={formData.reorderPoint}
                onChange={(e) => setFormData({ ...formData, reorderPoint: parseInt(e.target.value) || 0 })}
              />
              <Input
                label="Order Quantity"
                type="number"
                min={1}
                value={formData.orderQuantity}
                onChange={(e) => setFormData({ ...formData, orderQuantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Lead Time (days)"
                type="number"
                min={0}
                value={formData.leadTimeDays}
                onChange={(e) => setFormData({ ...formData, leadTimeDays: parseInt(e.target.value) || 0 })}
              />
              <Select
                label="Check Frequency"
                options={[
                  { label: 'Real-time', value: 'realtime' },
                  { label: 'Hourly', value: 'hourly' },
                  { label: 'Daily', value: 'daily' },
                  { label: 'Weekly', value: 'weekly' },
                ]}
                value={formData.checkFrequency}
                onChange={(option: any) => setFormData({ ...formData, checkFrequency: option.value })}
              />
            </div>
            
            <Input
              label="Vendor Name (optional)"
              placeholder="Preferred vendor for reorders"
              value={formData.vendorName}
              onChange={(e) => setFormData({ ...formData, vendorName: e.target.value })}
            />
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Text className="font-medium">Automatic Reordering</Text>
                <Text className="text-sm text-gray-500">Automatically create purchase orders</Text>
              </div>
              <Switch
                checked={formData.isAutomatic}
                onChange={() => setFormData({ ...formData, isAutomatic: !formData.isAutomatic })}
              />
            </div>
            
            <div className="flex items-center justify-between py-2">
              <div>
                <Text className="font-medium">Notify on Trigger</Text>
                <Text className="text-sm text-gray-500">Send email when rule triggers</Text>
              </div>
              <Switch
                checked={formData.notifyOnTrigger}
                onChange={() => setFormData({ ...formData, notifyOnTrigger: !formData.notifyOnTrigger })}
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => { setShowCreateModal(false); resetForm(); }}>
              Cancel
            </Button>
            <Button onClick={editingRule ? handleUpdateRule : handleCreateRule}>
              {editingRule ? 'Update Rule' : 'Create Rule'}
            </Button>
          </div>
        </div>
      </Modal>
    </motion.div>
  );
}
