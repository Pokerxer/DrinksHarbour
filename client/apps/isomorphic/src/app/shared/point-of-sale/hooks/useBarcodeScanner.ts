import { useEffect, useRef, useCallback } from 'react';

// Barcode scanners type each character in < 30 ms and end with Enter.
// Human typing is typically > 100 ms between characters.
const SCANNER_MAX_CHAR_MS = 40;
const SCANNER_MIN_LENGTH  = 3;

/**
 * Listens globally for barcode-scanner input.
 * A scan is detected when:
 *   - Every consecutive character arrived within SCANNER_MAX_CHAR_MS
 *   - The sequence ends with Enter (or reaches 50+ chars, for scanners without Enter)
 *   - The total sequence is at least SCANNER_MIN_LENGTH chars long
 *
 * Ignored when the focused element is a <textarea>.
 * For <input> elements: if the target is the POS search bar we let it handle the
 * search naturally; for *other* inputs we still intercept (some scanners focus a
 * hidden input deliberately).
 */
export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const chars      = useRef<string[]>([]);
  const times      = useRef<number[]>([]);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const flush = useCallback(() => {
    const code = chars.current.join('');
    chars.current = [];
    times.current = [];
    if (code.length >= SCANNER_MIN_LENGTH) onScan(code.trim());
  }, [onScan]);

  const reset = useCallback(() => {
    chars.current = [];
    times.current = [];
    clearTimeout(resetTimer.current);
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      // Never intercept inside textareas
      const target = e.target as HTMLElement;
      if (target.tagName === 'TEXTAREA') return;
      // Don't intercept modifier combos
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      const now = Date.now();

      if (e.key === 'Enter') {
        // Determine if this Enter closes a barcode sequence
        if (chars.current.length >= SCANNER_MIN_LENGTH) {
          // All gaps must be ≤ SCANNER_MAX_CHAR_MS
          const allFast = times.current.every(
            (t, i) => i === 0 || t - times.current[i - 1] <= SCANNER_MAX_CHAR_MS
          );
          if (allFast) {
            // Prevent the Enter from submitting forms / triggering buttons
            e.preventDefault();
            e.stopPropagation();
            flush();
            return;
          }
        }
        reset();
        return;
      }

      if (e.key.length !== 1) return; // ignore Shift, Backspace, etc.

      // If the gap since the last char is too long, this is human typing → reset
      if (times.current.length > 0) {
        const gap = now - times.current[times.current.length - 1];
        if (gap > SCANNER_MAX_CHAR_MS) {
          reset();
        }
      }

      chars.current.push(e.key);
      times.current.push(now);

      // Auto-flush for scanners that don't send Enter (after 50+ chars or 80ms silence)
      clearTimeout(resetTimer.current);
      if (chars.current.length >= 50) {
        flush();
      } else {
        resetTimer.current = setTimeout(() => {
          // After 80ms of silence: if it was fast enough, treat as scan
          if (chars.current.length >= SCANNER_MIN_LENGTH) {
            const allFast = times.current.every(
              (t, i) => i === 0 || t - times.current[i - 1] <= SCANNER_MAX_CHAR_MS
            );
            if (allFast) flush();
            else reset();
          } else {
            reset();
          }
        }, 80);
      }
    }

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => {
      window.removeEventListener('keydown', onKeyDown, { capture: true });
      clearTimeout(resetTimer.current);
    };
  }, [flush, reset]);
}
