'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { Button, Text } from 'rizzui';
import { promotionService, Promotion } from '@/services/promotion.service';
import { PiFunnel, PiPlus, PiArrowClockwise, PiTagBold, PiPencil, PiTrash } from 'react-icons/pi';
import Link from 'next/link';
import { routes } from '@/config/routes';

export default function PromotionListTable() {
  const { data: session } = useSession();
  const [data, setData] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const token = session?.user?.token;

  useEffect(() => {
    if (token) {
      fetchPromotions();
    }
  }, [token, searchTerm]);

  const fetchPromotions = async () => {
    try {
      setLoading(true);
      const res = await promotionService.getPromotions(token as string, {
        search: searchTerm,
        limit: 100,
      }) as { data?: Promotion[]; pagination?: { total: number } };
      setData(res.data || []);
    } catch (error) {
      console.error('Failed to fetch promotions:', error);
    } finally {
      setLoading(false);
    }
  };

  const onDeleteItem = async (id: string) => {
    if (!confirm('Are you sure you want to delete this promotion?')) return;
    try {
      await promotionService.deletePromotion(id, token as string);
      alert('Promotion deleted successfully');
      await fetchPromotions();
    } catch (error: any) {
      alert(error.message || 'Failed to delete promotion');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
          <PiTagBold className="h-8 w-8 text-gray-400" />
        </div>
        <Text className="mb-2 text-lg font-semibold text-gray-900 dark:text-gray-100">
          No promotions yet
        </Text>
        <Text className="mb-6 max-w-sm text-gray-500">
          Create your first promotion to boost sales, reward customers, or clear inventory.
        </Text>
        <Button as="a" href="/ecommerce/promotions/create">
          <PiPlus className="mr-1 h-4 w-4" />
          Create Promotion
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-gray-200 dark:bg-gray-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div className="relative">
          <input
            type="text"
            placeholder="Search promotions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-9 w-64 rounded-md border border-gray-300 bg-white px-3 py-1 pl-9 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary dark:border-gray-700 dark:bg-gray-900"
          />
          <PiFunnel className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        </div>
        <Button variant="outline" size="sm" className="gap-1" onClick={() => fetchPromotions()}>
          <PiArrowClockwise className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-5 py-3 font-medium">Promotion</th>
              <th className="px-5 py-3 font-medium">Type</th>
              <th className="px-5 py-3 font-medium">Discount</th>
              <th className="px-5 py-3 font-medium">Target</th>
              <th className="px-5 py-3 font-medium">Schedule</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {data.map((promotion) => (
              <tr key={promotion._id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{promotion.name}</span>
                    {promotion.code && (
                      <span className="text-xs text-gray-500">Code: <span className="font-mono text-primary">{promotion.code}</span></span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium">
                    {promotion.type.replace(/_/g, ' ')}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className="font-semibold text-green-600">
                    {promotion.type === 'buy_x_get_y' 
                      ? `Buy ${promotion.buyQuantity} → Get ${promotion.getQuantity}`
                      : promotion.discountType === 'percentage' 
                        ? `${promotion.discountValue}%`
                        : `₦${promotion.discountValue}`}
                  </span>
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  {promotion.applyTo === 'all' ? 'All Products' : promotion.applyTo.replace(/_/g, ' ')}
                  {promotion.subProducts && promotion.subProducts.length > 0 && (
                    <span className="ml-1 text-gray-400">({promotion.subProducts.length})</span>
                  )}
                </td>
                <td className="px-5 py-4 text-sm text-gray-600">
                  <div>{promotion.startDate ? new Date(promotion.startDate).toLocaleDateString() : '-'}</div>
                  <div className="text-xs text-gray-400">
                    {promotion.endDate ? new Date(promotion.endDate).toLocaleDateString() : 'No end'}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                    promotion.status === 'active' ? 'bg-green-100 text-green-700' :
                    promotion.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                    promotion.status === 'paused' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {promotion.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link href={routes.eCommerce.editPromotion(promotion._id)}>
                      <Button variant="outline" size="xs">
                        <PiPencil className="h-3 w-3" />
                      </Button>
                    </Link>
                    <Button variant="outline" size="xs" color="danger" onClick={() => onDeleteItem(promotion._id)}>
                      <PiTrash className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
