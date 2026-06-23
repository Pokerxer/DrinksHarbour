// @ts-nocheck
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import {
  PiPlus, PiPencil, PiTrash, PiPlayCircle, PiLightning,
  PiSpinner, PiWarningCircle, PiCheckCircle, PiX, PiPause,
} from 'react-icons/pi';
import { reorderService, type ReorderRule, type ReorderSuggestion } from '@/services/reorder.service';

interface RulesTabProps {
  subProductId: string | undefined;
  totalStock: number;
  reorderPoint: number;
  reorderQuantity: number;
  lowStockThreshold: number;
}

const FIELD = 'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none';

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-gray-800' : 'bg-gray-200'}`}>
      <span className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  );
}

const URGENCY_CLS: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high:     'bg-amber-100 text-amber-700',
  medium:   'bg-blue-100 text-blue-700',
  low:      'bg-gray-100 text-gray-600',
};

export function RulesTab({
  subProductId,
  totalStock,
  reorderPoint,
  reorderQuantity,
  lowStockThreshold,
}: RulesTabProps) {
  const { data: session } = useSession();

  const [rules,           setRules]           = useState<ReorderRule[]>([]);
  const [suggestions,     setSuggestions]     = useState<ReorderSuggestion[]>([]);
  const [isLoading,       setIsLoading]       = useState(false);
  const [showModal,       setShowModal]       = useState(false);
  const [editingRule,     setEditingRule]     = useState<ReorderRule | null>(null);
  const [isSubmitting,    setIsSubmitting]    = useState(false);

  const [form, setForm] = useState({
    name:            '',
    description:     '',
    triggerType:     'reorder_point',
    reorderPoint:    reorderPoint || 10,
    orderQuantity:   reorderQuantity || 50,
    leadTimeDays:    7,
    vendorName:      '',
    isAutomatic:     false,
    notifyOnTrigger: true,
    checkFrequency:  'daily',
  });

  const setField = (key: string, value: any) => setForm(p => ({ ...p, [key]: value }));

  const resetForm = () => {
    setForm({
      name: '', description: '', triggerType: 'reorder_point',
      reorderPoint: reorderPoint || 10, orderQuantity: reorderQuantity || 50,
      leadTimeDays: 7, vendorName: '', isAutomatic: false,
      notifyOnTrigger: true, checkFrequency: 'daily',
    });
    setEditingRule(null);
  };

  const fetchRules = useCallback(async () => {
    if (!session?.user?.token || !subProductId) return;
    setIsLoading(true);
    try {
      const res = await reorderService.getRules(session.user.token, { subProductId, limit: 50 });
      if (res.success) setRules(res.data || []);
    } catch { /* silent */ }
    finally { setIsLoading(false); }
  }, [session?.user?.token, subProductId]);

  const fetchSuggestions = useCallback(async () => {
    if (!session?.user?.token) return;
    try {
      const res = await reorderService.getSuggestions(session.user.token);
      if (res.success) setSuggestions(res.data || []);
    } catch { /* silent */ }
  }, [session?.user?.token]);

  useEffect(() => { fetchRules(); fetchSuggestions(); }, [fetchRules, fetchSuggestions]);

  async function handleSubmit() {
    if (!session?.user?.token || !subProductId) return;
    if (!form.name.trim()) { toast.error('Rule name is required'); return; }
    setIsSubmitting(true);
    try {
      if (editingRule) {
        await reorderService.updateRule(editingRule._id, form, session.user.token);
        toast.success('Reorder rule updated');
      } else {
        await reorderService.createRule({ ...form, subProductId }, session.user.token);
        toast.success('Reorder rule created');
      }
      setShowModal(false);
      resetForm();
      fetchRules();
    } catch (e: any) {
      toast.error(e.message || 'Failed to save rule');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(ruleId: string) {
    if (!session?.user?.token) return;
    if (!confirm('Delete this reorder rule?')) return;
    try {
      await reorderService.deleteRule(ruleId, session.user.token);
      toast.success('Rule deleted');
      fetchRules();
    } catch (e: any) { toast.error(e.message || 'Failed to delete'); }
  }

  async function handleToggleStatus(rule: ReorderRule) {
    if (!session?.user?.token) return;
    try {
      await reorderService.updateRule(rule._id, { status: rule.status === 'active' ? 'paused' : 'active' }, session.user.token);
      toast.success(`Rule ${rule.status === 'active' ? 'paused' : 'activated'}`);
      fetchRules();
    } catch (e: any) { toast.error(e.message || 'Failed to update'); }
  }

  async function handleTrigger(ruleId: string) {
    if (!session?.user?.token) return;
    try {
      await reorderService.triggerRule(ruleId, session.user.token, 'Manual trigger');
      toast.success('Rule triggered');
      fetchRules();
    } catch (e: any) { toast.error(e.message || 'Failed to trigger'); }
  }

  function openEdit(rule: ReorderRule) {
    setEditingRule(rule);
    setForm({
      name: rule.name, description: rule.description || '',
      triggerType: rule.triggerType, reorderPoint: rule.reorderPoint,
      orderQuantity: rule.orderQuantity, leadTimeDays: rule.leadTimeDays,
      vendorName: rule.vendorName || '', isAutomatic: rule.isAutomatic,
      notifyOnTrigger: rule.notifyOnTrigger, checkFrequency: rule.checkFrequency,
    });
    setShowModal(true);
  }

  const needsReorder = totalStock <= reorderPoint;

  return (
    <div className="space-y-5">

      {/* ── Reorder alert banner ── */}
      {needsReorder && (
        <div className="flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
          <PiWarningCircle className="h-5 w-5 shrink-0 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">Reorder Recommended</p>
            <p className="text-xs text-amber-600">
              Current stock ({totalStock}) is at or below the reorder point ({reorderPoint})
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-800">
            Suggest: {reorderQuantity} units
          </span>
        </div>
      )}

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-bold text-gray-900">Reordering Rules</p>
          <p className="text-[11px] text-gray-400">Automate stock replenishment when inventory runs low</p>
        </div>
        <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
          className="flex items-center gap-1.5 rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-gray-700 transition-colors">
          <PiPlus className="h-3.5 w-3.5" /> Add Rule
        </button>
      </div>

      {/* ── Loading ── */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <PiSpinner className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* ── Rules table ── */}
      {!isLoading && rules.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Rule Name</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-wider text-gray-400">Trigger</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Reorder Point</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400">Order Qty</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold uppercase tracking-wider text-gray-400 hidden sm:table-cell">Lead Time</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Status</th>
                  <th className="px-4 py-2.5 text-center text-[10px] font-bold uppercase tracking-wider text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rules.map(rule => (
                  <tr key={rule._id} className="hover:bg-gray-50/60">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-800">{rule.name}</p>
                      {rule.description && <p className="text-[10px] text-gray-400 truncate max-w-[160px]">{rule.description}</p>}
                      {rule.isAutomatic && (
                        <span className="inline-block rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-bold text-green-700">Auto</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 capitalize">
                        {(rule.triggerType || '').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-700">{rule.reorderPoint}</td>
                    <td className="px-4 py-3 text-right font-semibold tabular-nums text-gray-700">{rule.orderQuantity}</td>
                    <td className="px-4 py-3 text-right text-gray-500 hidden sm:table-cell">{rule.leadTimeDays}d</td>
                    <td className="px-4 py-3 text-center">
                      <button type="button" onClick={() => handleToggleStatus(rule)}
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize transition-colors ${
                          rule.status === 'active' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {rule.status}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-0.5">
                        <button type="button" onClick={() => handleTrigger(rule._id)} title="Trigger now"
                          className="rounded p-1 text-amber-400 hover:bg-amber-50 hover:text-amber-600">
                          <PiLightning className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => openEdit(rule)} title="Edit"
                          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                          <PiPencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => handleDelete(rule._id)} title="Delete"
                          className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                          <PiTrash className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty state ── */}
      {!isLoading && rules.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 py-16 text-center">
          <PiPlayCircle className="h-12 w-12 text-gray-200" />
          <p className="mt-3 text-sm font-medium text-gray-500">No reordering rules yet</p>
          <p className="mt-1 text-xs text-gray-400">Add rules to automate stock replenishment</p>
          <button type="button" onClick={() => { resetForm(); setShowModal(true); }}
            className="mt-5 flex items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700">
            <PiPlus className="h-4 w-4" /> Create First Rule
          </button>
        </div>
      )}

      {/* ── Suggestions ── */}
      {suggestions.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-bold text-gray-700">Reorder Suggestions</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {suggestions.slice(0, 6).map(s => (
              <div key={s.subProductId} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-semibold text-gray-800">{s.sku}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${URGENCY_CLS[s.urgency] || URGENCY_CLS.low}`}>
                    {s.urgency}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-gray-600">
                  <div className="flex justify-between">
                    <span>Current Stock</span>
                    <span className="font-semibold tabular-nums">{s.currentStock}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Suggested Order</span>
                    <span className="font-semibold tabular-nums text-blue-600">{s.suggestedQuantity}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Est. Cost</span>
                    <span className="font-semibold tabular-nums">₦{s.estimatedCost?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create / Edit modal ── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
          onClick={() => { setShowModal(false); resetForm(); }}>
          <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
              <p className="text-sm font-bold text-gray-900">
                {editingRule ? 'Edit Reorder Rule' : 'Create Reorder Rule'}
              </p>
              <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <PiX className="h-4 w-4" />
              </button>
            </div>

            {/* Form */}
            <div className="max-h-[65vh] overflow-y-auto px-5 py-4 space-y-4">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Rule Name <span className="text-red-500">*</span>
                </label>
                <input type="text" value={form.name} onChange={e => setField('name', e.target.value)}
                  placeholder="e.g. Low Stock Alert" className={FIELD} />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Description</label>
                <input type="text" value={form.description} onChange={e => setField('description', e.target.value)}
                  placeholder="Optional description" className={FIELD} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Trigger Type</label>
                  <select value={form.triggerType} onChange={e => setField('triggerType', e.target.value)}
                    className={`${FIELD} bg-white`}>
                    <option value="reorder_point">Reorder Point</option>
                    <option value="min_quantity">Min Quantity</option>
                    <option value="days_of_stock">Days of Stock</option>
                    <option value="manual">Manual Only</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Check Frequency</label>
                  <select value={form.checkFrequency} onChange={e => setField('checkFrequency', e.target.value)}
                    className={`${FIELD} bg-white`}>
                    <option value="realtime">Real-time</option>
                    <option value="hourly">Hourly</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Reorder Point</label>
                  <input type="number" min="0" value={form.reorderPoint}
                    onChange={e => setField('reorderPoint', parseInt(e.target.value) || 0)} className={FIELD} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Order Qty</label>
                  <input type="number" min="1" value={form.orderQuantity}
                    onChange={e => setField('orderQuantity', parseInt(e.target.value) || 1)} className={FIELD} />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Lead Time (d)</label>
                  <input type="number" min="0" value={form.leadTimeDays}
                    onChange={e => setField('leadTimeDays', parseInt(e.target.value) || 0)} className={FIELD} />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-400 mb-1">Vendor Name</label>
                <input type="text" value={form.vendorName} onChange={e => setField('vendorName', e.target.value)}
                  placeholder="Preferred vendor for reorders" className={FIELD} />
              </div>

              {[
                { key: 'isAutomatic',     label: 'Automatic Reordering',  desc: 'Automatically create purchase orders when triggered' },
                { key: 'notifyOnTrigger', label: 'Notify on Trigger',     desc: 'Send email notification when rule triggers' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    <p className="text-[11px] text-gray-400">{desc}</p>
                  </div>
                  <Toggle checked={form[key]} onChange={() => setField(key, !form[key])} />
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-5 py-4">
              <button type="button" onClick={() => { setShowModal(false); resetForm(); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={isSubmitting}
                className="flex items-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-700 disabled:opacity-50 transition-colors">
                {isSubmitting ? <><PiSpinner className="h-3.5 w-3.5 animate-spin" />Saving…</> : (editingRule ? 'Save Changes' : 'Create Rule')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
