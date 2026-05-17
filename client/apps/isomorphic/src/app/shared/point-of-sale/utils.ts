export function formatCurrency(amount: number, currency = 'NGN'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(date: string | Date): string {
  const d = new Date(date);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function getImageUrl(product: any): string | undefined {
  if (product?.product?.images?.length) {
    const img = product.product.images[0];
    return img.thumbnail || img.url;
  }
  if (product?.image) return product.image;
  return undefined;
}

export function getProductDisplayName(product: any): string {
  return product?.product?.name || product?.name || 'Unknown Product';
}

export function getStockStatusLabel(status: string): { label: string; color: string } {
  switch (status) {
    case 'in_stock':
      return { label: 'In Stock', color: 'text-green-600' };
    case 'low_stock':
      return { label: 'Low Stock', color: 'text-orange-500' };
    case 'out_of_stock':
      return { label: 'Out of Stock', color: 'text-red-500' };
    default:
      return { label: status, color: 'text-gray-500' };
  }
}

export function calculateChange(amountTendered: number, total: number): number {
  return Math.max(0, amountTendered - total);
}

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash', icon: '💰' },
  { value: 'card', label: 'Card', icon: '💳' },
  { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
  { value: 'mobile_money', label: 'Mobile Money', icon: '📱' },
  { value: 'split', label: 'Split Payment', icon: '🔀' },
];
