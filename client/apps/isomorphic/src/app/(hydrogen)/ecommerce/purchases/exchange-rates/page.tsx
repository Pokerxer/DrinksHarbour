// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiArrowsLeftRightBold,
  PiTrashBold,
  PiPencilBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { exchangeRateService, ExchangeRate } from '@/services/exchangeRate.service';

const CURRENCY_OPTIONS = [
  { value: 'NGN', label: 'NGN - Nigerian Naira' },
  { value: 'USD', label: 'USD - US Dollar' },
  { value: 'EUR', label: 'EUR - Euro' },
  { value: 'GBP', label: 'GBP - British Pound' },
];

export default function ExchangeRatesPage() {
  const { data: session } = useSession();
  const [rates, setRates] = useState<ExchangeRate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    fromCurrency: 'USD',
    toCurrency: 'NGN',
    rate: 1,
    effectiveDate: new Date().toISOString().split('T')[0],
    isActive: true,
    notes: '',
  });

  const fetchRates = async () => {
    if (!session?.user?.token) return;
    setIsLoading(true);
    try {
      const response = await exchangeRateService.getRates(session.user.token);
      if (response.success) {
        setRates(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch rates:', error);
      toast.error('Failed to load exchange rates');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.token) {
      fetchRates();
    }
  }, [session?.user?.token]);

  const handleSubmit = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    if (!formData.rate || formData.rate <= 0) {
      toast.error('Rate must be greater than 0');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await exchangeRateService.createRate(formData, session.user.token);
      if (response.success) {
        toast.success('Exchange rate saved');
        setShowForm(false);
        setFormData({
          fromCurrency: 'USD',
          toCurrency: 'NGN',
          rate: 1,
          effectiveDate: new Date().toISOString().split('T')[0],
          isActive: true,
          notes: '',
        });
        fetchRates();
      } else {
        toast.error(response.message || 'Failed to save');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to save');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this exchange rate?')) return;
    if (!session?.user?.token) return;
    
    try {
      const response = await exchangeRateService.deleteRate(id, session.user.token);
      if (response.success) {
        toast.success('Deleted');
        fetchRates();
      } else {
        toast.error(response.message || 'Failed to delete');
      }
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  return (
    <>
      <PageHeader
        title="Currency Exchange Rates"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { name: 'Exchange Rates' },
        ]}
      >
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Button onClick={() => setShowForm(!showForm)}>
            <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
            Add Rate
          </Button>
        </div>
      </PageHeader>

      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Add Exchange Rate</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From</label>
              <Select
                options={CURRENCY_OPTIONS}
                value={formData.fromCurrency}
                onChange={(e) => setFormData({ ...formData, fromCurrency: e.target.value })}
              />
            </div>
            <div className="flex items-end justify-center pb-1">
              <PiArrowsLeftRightBold className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To</label>
              <Select
                options={CURRENCY_OPTIONS}
                value={formData.toCurrency}
                onChange={(e) => setFormData({ ...formData, toCurrency: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Rate</label>
              <Input
                type="number"
                min="0.0001"
                step="0.01"
                value={formData.rate}
                onChange={(e) => setFormData({ ...formData, rate: parseFloat(e.target.value) || 0 })}
                placeholder="1 USD = ? NGN"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Effective Date</label>
              <Input
                type="date"
                value={formData.effectiveDate}
                onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSubmit} isLoading={isSubmitting}>Save</Button>
          </div>
        </div>
      )}

      <div className="grid gap-6">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-blue-600" />
          </div>
        ) : rates.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <PiArrowsLeftRightBold className="h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No exchange rates configured</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              Add First Rate
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-600">From</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">To</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Rate</th>
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Effective Date</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate._id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-medium">{rate.fromCurrency}</td>
                    <td className="px-6 py-4 font-medium">{rate.toCurrency}</td>
                    <td className="px-6 py-4 text-right font-mono">
                      1 {rate.fromCurrency} = {rate.rate.toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })} {rate.toCurrency}
                    </td>
                    <td className="px-6 py-4">
                      {rate.effectiveDate && new Date(rate.effectiveDate).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        rate.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {rate.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => handleDelete(rate._id)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <PiTrashBold className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
