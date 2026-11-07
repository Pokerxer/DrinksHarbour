export default function ListingDescription({
  description,
  isOverride,
}: {
  description?: string;
  isOverride: boolean;
}) {
  return (
    <section
      aria-labelledby="listing-description"
      className="rounded-2xl border border-gray-200 bg-white p-5"
    >
      <h2 id="listing-description" className="text-lg font-semibold">
        Listing description
      </h2>
      {description ? (
        <>
          <p className="mt-1 text-xs text-gray-500">
            {isOverride ? 'Listing copy' : 'Central product copy'}
          </p>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700">
            {description}
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-gray-500">
          No description has been recorded.
        </p>
      )}
    </section>
  );
}
