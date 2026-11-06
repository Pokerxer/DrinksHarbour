/** Enter sends, Shift+Enter inserts a newline — but only for real desktop
 * keyboards. At event time the caller checks the pointer media query so
 * touch/virtual keyboards keep their platform behaviour (Enter = newline or
 * button focus, never hijacked), and an active IME composition (confirming
 * candidate text with Enter) is never treated as a send. Button submit keeps
 * working on every device. */
export function enterSubmitsMessage(event: { key: string; shiftKey: boolean; isComposing?: boolean }): boolean {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return false;
  try {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return true;
    return !window.matchMedia('(hover: none), (pointer: coarse)').matches;
  } catch {
    return true;
  }
}
