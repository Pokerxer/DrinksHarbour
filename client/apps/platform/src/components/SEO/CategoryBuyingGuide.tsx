import Link from 'next/link';
import type { CategoryBuyingGuide as Guide } from '@/lib/categoryBuyingGuide';

export default function CategoryBuyingGuide({ guide }: { guide: Guide }) {
  return (
    <section className="border-t border-gray-200 bg-white" aria-labelledby="category-buying-guide">
      <div className="container mx-auto grid gap-8 px-4 py-10 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 id="category-buying-guide" className="text-2xl font-bold text-gray-900">Choosing your {guide.name.toLowerCase()}</h2>
          <p className="mt-4 max-w-3xl leading-7 text-gray-700">{guide.advice}</p>
          <h3 className="mt-6 text-lg font-semibold">Compare the complete order</h3>
          <p className="mt-2 max-w-3xl leading-7 text-gray-700">{guide.compare}</p>
        </div>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6">
          <h3 className="text-lg font-semibold">Buying in Nigeria</h3>
          <p className="mt-3 text-sm leading-6 text-gray-700">Check the selected seller, size and available stock before adding to your cart. Delivery fees and the available window depend on your address and order. Alcoholic drinks are for adults aged 18 and over.</p>
          <nav aria-label={`${guide.name} buying information`} className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-red-800 underline underline-offset-4">
            <Link href="/delivery/abuja">Abuja delivery</Link>
            <Link href="/delivery/lagos">Lagos delivery</Link>
            <Link href="/authenticity-guarantee">Authenticity & bottle checks</Link>
            <Link href="/bulk-drinks">Bulk buying</Link>
            <Link href="/occasions">Drinks for occasions</Link>
          </nav>
        </div>
      </div>
    </section>
  );
}
