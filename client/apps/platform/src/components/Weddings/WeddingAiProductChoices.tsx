import type { BottleChoice } from '@/lib/weddingBottleList';
import BottleThumbnail from './BottleThumbnail';

export default function WeddingAiProductChoices({ products, loading, onChoose }: { products: BottleChoice[]; loading: boolean; onChoose?: (choice: BottleChoice) => void }) {
  return <div className="mt-4 grid gap-2 sm:grid-cols-2">{products.map(product => <div key={product.productId} className="rounded-xl border border-rose-100 bg-[#fcfaf8] p-3">
    <div className="flex items-start gap-3"><BottleThumbnail src={product.image} /><div className="min-w-0"><p className="break-words text-sm font-bold text-[#351014]">{product.name}</p>
      <a href={`/product/${encodeURIComponent(product.slug || '')}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block min-h-9 text-xs font-semibold text-[#7c1d1d] underline">View sizes &amp; current offers</a>
    </div></div>
    {onChoose && <button type="button" disabled={loading} onClick={() => onChoose(product)} className="mt-2 block min-h-11 w-full rounded-lg border border-rose-200 px-3 py-2 text-left text-xs font-bold text-[#7c1d1d] hover:bg-rose-50 disabled:opacity-50">Add {product.suggestedQuantity ? `${product.suggestedQuantity} × ` : ''}{product.name} to planning list</button>}
  </div>)}</div>;
}
