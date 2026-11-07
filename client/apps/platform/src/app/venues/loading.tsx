export default function Loading() {
  return <main className="container mx-auto max-w-6xl space-y-8 px-4 py-12 sm:px-6" aria-busy="true">
    <p role="status" className="font-medium text-stone-600">Loading venue details…</p>
    <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
      <div className="h-48 rounded-2xl bg-stone-200" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map(index => <div key={index} className="h-64 rounded-2xl bg-stone-100" />)}</div>
    </div>
  </main>;
}
