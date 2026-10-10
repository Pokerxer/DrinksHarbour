import type { PromotionSuggestion } from '@/services/promotionSuggestions.service';
import WarehouseProductImage from '../warehouses/warehouse-product-image';
import { money } from '../insights/presentation';
export default function PromotionCard({
  suggestion: s,
  open,
}: {
  suggestion: PromotionSuggestion;
  open: () => void;
}) {
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      onClick={open}
      className="flex flex-col rounded-2xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-[#b20202] hover:shadow-md focus-visible:ring-2 focus-visible:ring-[#b20202]"
    >
      <div className="mb-3 flex gap-2">
        {s.products.map((p) => (
          <WarehouseProductImage
            key={p.key}
            src={p.image}
            name={p.productName}
          />
        ))}
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#b20202]">
        {s.type === 'combo'
          ? 'Sales-based combo'
          : s.type === 'occasion'
            ? 'Special-day offer'
            : 'Slow-mover review'}
      </p>
      <h2 className="mt-1 text-sm font-semibold text-gray-900">{s.title}</h2>
      <p className="mt-1 text-xs text-gray-500">
        {s.products.map((p) => p.sizeName).join(' + ')} · {s.warehouseName}
      </p>
      <p className="mt-3 text-sm font-semibold">
        {s.pricing.offerPrice !== null && s.pricing.currency
          ? `${money(s.pricing.offerPrice, s.pricing.currency)} · ${s.pricing.discountPercent}% off`
          : 'Review pricing'}
      </p>
      <p className="mt-2 text-xs text-gray-500">
        {s.evidence
          ? `${s.evidence.jointBaskets} shared baskets · ${s.confidence} evidence`
          : 'Exploratory offer · review required'}
      </p>
      <span className="mt-auto pt-4 text-xs font-semibold text-[#b20202]">
        View suggestion →
      </span>
    </button>
  );
}
