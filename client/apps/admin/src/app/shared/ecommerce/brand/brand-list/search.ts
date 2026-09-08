export function matchesBrandSearch(
  brand: { name: string; slug: string },
  search: string
) {
  const query = search.trim().toLocaleLowerCase();
  return (
    !query ||
    [brand.name, brand.slug].some((value) =>
      value.toLocaleLowerCase().includes(query)
    )
  );
}
