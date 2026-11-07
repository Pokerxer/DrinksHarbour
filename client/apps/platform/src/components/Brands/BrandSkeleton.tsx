export default function BrandSkeleton() {
  return (
    <div aria-hidden="true" className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse motion-reduce:animate-none">
      <div className="h-28 bg-gray-200" />
      <div className="p-4 space-y-2">
        <div className="h-4 bg-gray-200 rounded w-3/4 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-1/2 mx-auto" />
        <div className="h-3 bg-gray-100 rounded w-2/3 mx-auto" />
      </div>
    </div>
  );
}

