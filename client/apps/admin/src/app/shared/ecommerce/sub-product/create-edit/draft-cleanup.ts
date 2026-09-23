/** Remove legacy drafts; creation now lives only in the mounted form. */
export function clearSubProductDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem('subproduct-draft');
  } catch {
    // Browser storage can be disabled. Cleanup must not break server saves.
    // Nothing reads or restores this key, even when removal is unavailable.
  }
}
