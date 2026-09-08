export async function runSearchRequest<T>(
  fetchItems: () => Promise<T[]>,
  signal: AbortSignal,
  onResult: (items: T[], error?: string) => void
) {
  try {
    const items = await fetchItems();
    if (!signal.aborted) onResult(items);
  } catch (error) {
    if (!signal.aborted)
      onResult(
        [],
        error instanceof Error ? error.message : 'Search failed. Please retry.'
      );
  }
}
