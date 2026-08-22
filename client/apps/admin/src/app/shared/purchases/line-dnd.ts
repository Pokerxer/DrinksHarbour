// Dependency-free reorder helper for purchase order lines. Native HTML5 DnD
// lives in the create/edit forms; this module only owns the array math so it
// stays unit-testable.

/** Reorder by moving the item at `from` to index `to`. Out-of-bounds drags
 *  are no-ops; the source array is never mutated. */
export function moveItem<T>(arr: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= arr.length ||
    to >= arr.length
  )
    return [...arr];
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}
