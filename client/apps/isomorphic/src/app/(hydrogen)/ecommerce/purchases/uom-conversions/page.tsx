// @ts-nocheck
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import toast from 'react-hot-toast';
import { 
  PiPlusBold, 
  PiTrashBold,
  PiArrowsLeftRightBold,
  PiArrowRightBold,
} from 'react-icons/pi';
import { routes } from '@/config/routes';
import { Button, Input, Select } from 'rizzui';
import PageHeader from '@/app/shared/page-header';
import { uomConversionService, UOMConversion } from '@/services/uomConversion.service';

const UOM_OPTIONS = uomConversionService.getUOMOptions();

export default function UOMConversionsPage() {
  const { data: session } = useSession();
  const [conversions, setConversions] = useState<UOMConversion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    fromUOM: '',
    toUOM: '',
    conversionFactor: 1,
    isActive: true,
    notes: '',
  });

  const fetchConversions = async () => {
    if (!session?.user?.token) return;
    setIsLoading(true);
    try {
      const response = await uomConversionService.getConversions(session.user.token);
      if (response.success) {
        setConversions(response.data);
      }
    } catch (error) {
      console.error('Failed to fetch conversions:', error);
      toast.error('Failed to load conversions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user?.token) {
      fetchConversions();
    }
  }, [session?.user?.token]);

  const handleSubmit = async () => {
    if (!session?.user?.token) {
      toast.error('Please sign in');
      return;
    }

    if (!formData.name || !formData.fromUOM || !formData.toUOM) {
      toast.error('All fields are required');
      return;
    }

    if (formData.fromUOM === formData.toUOM) {
      toast.error('From and To UOM must be different');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await uomConversionService.createConversion(formData, session.user.token);
      if (response.success) {
        toast.success('Conversion created');
        setShowForm(false);
        setFormData({
          name: '',
          fromUOM: '',
          toUOM: '',
          conversionFactor: 1,
          isActive: true,
          notes: '',
        });
        fetchConversions();
      } else {
        toast.error(response.message || 'Failed to create');
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this conversion?')) return;
    if (!session?.user?.token) return;
    
    try {
      const response = await uomConversionService.deleteConversion(id, session.user.token);
      if (response.success) {
        toast.success('Deleted');
        fetchConversions();
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
        title="UOM Conversions"
        breadcrumb={[
          { href: routes.eCommerce.dashboard, name: 'E-Commerce' },
          { href: routes.eCommerce.purchases, name: 'Purchases' },
          { name: 'UOM Conversions' },
        ]}
      >
        <div className="mt-4 flex items-center gap-3 @lg:mt-0">
          <Button onClick={() => setShowForm(!showForm)}>
            <PiPlusBold className="me-1.5 h-[17px] w-[17px]" />
            New Conversion
          </Button>
        </div>
      </PageHeader>

      {showForm && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold">Create UOM Conversion</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Cases to Units"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">From UOM</label>
              <Select
                options={UOM_OPTIONS}
                value={formData.fromUOM}
                onChange={(e) => setFormData({ ...formData, fromUOM: e.target.value })}
                placeholder="Select"
              />
            </div>
            <div className="flex items-end justify-center pb-1">
              <PiArrowsLeftRightBold className="h-6 w-6 text-gray-400" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">To UOM</label>
              <Select
                options={UOM_OPTIONS}
                value={formData.toUOM}
                onChange={(e) => setFormData({ ...formData, toUOM: e.target.value })}
                placeholder="Select"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Factor</label>
              <Input
                type="number"
                min="0.0001"
                step="0.0001"
                value={formData.conversionFactor}
                onChange={(e) => setFormData({ ...formData, conversionFactor: parseFloat(e.target.value) || 1 })}
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
        ) : conversions.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50">
            <PiArrowsLeftRightBold className="h-12 w-12 text-gray-400" />
            <p className="mt-2 text-gray-500">No UOM conversions found</p>
            <Button className="mt-4" onClick={() => setShowForm(true)}>
              Create First Conversion
            </Button>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-6 py-3 text-left font-medium text-gray-600">Name</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600">Conversion</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600">Factor</th>
                  <th className="px-6 py-3 text-center font-medium text-gray-600">Status</th>
                  <th className="px-6 py-3 text-right font-medium text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((conversion) => (
                  <tr key={conversion._id} className="border-b border-gray-50">
                    <td className="px-6 py-4 font-medium">{conversion.name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <span className="font-medium">{conversion.fromUOM}</span>
                        <PiArrowRightBold className="h-4 w-4 text-gray-400" />
                        <span className="font-medium">{conversion.toUOM}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      1 {conversion.fromUOM} = {conversion.conversionFactor} {conversion.toUOM}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        conversion.isActive 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {conversion.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="text"
                        size="sm"
                        onClick={() => handleDelete(conversion._id)}
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
