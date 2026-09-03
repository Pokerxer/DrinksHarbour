/**
 * Latest-wins guard for a type-ahead that fires overlapping requests.
 *
 * Regression origin: typing "monte" into the sub-product Search Product field
 * showed MODAelsueno / Moët & Chandon / Moillard — none of which contain
 * "monte", while the product that does ("Monte dos Perdigões Vinhas Velhas
 * Tinto") was missing. The matcher was innocent: its regex matches the Monte
 * product and rejects all three of those. What was showing was the response to
 * an EARLIER keystroke — every one of those three matches the prefix "mo".
 *
 * The search had no AbortController and no sequence check, so `setProducts` ran
 * for whichever response arrived last rather than whichever query was current.
 * A user who concludes the product isn't in the catalogue clicks "Create new
 * product" — which is how the same product gets saved twice.
 *
 * Kept as a standalone module because admin vitest runs `environment: 'node'`:
 * components cannot be rendered, so the logic worth testing has to live outside
 * one.
 */
export class LatestRequest {
  private seq = 0;
  // Null means no attempt is outstanding. Tracked separately from the counter
  // so "nothing is current" is stated rather than implied by a sentinel value —
  // comparing against the bare counter made the never-issued ticket 0 read as
  // current on a fresh instance.
  private current: number | null = null;
  private controller: AbortController | null = null;

  /**
   * Open a new attempt, cancelling any still in flight. Returns the ticket the
   * caller must present to `isCurrent` before applying a result.
   */
  begin(): { ticket: number; signal: AbortSignal } {
    this.controller?.abort();
    this.controller = new AbortController();
    this.seq += 1;
    this.current = this.seq;
    return { ticket: this.seq, signal: this.controller.signal };
  }

  /** True only for the most recently begun attempt. */
  isCurrent(ticket: number): boolean {
    return this.current !== null && ticket === this.current;
  }

  /** Cancel anything in flight without opening a new attempt. */
  cancel(): void {
    this.controller?.abort();
    this.controller = null;
    this.current = null;
  }
}

/**
 * An abort is a cancellation we caused, not a failure to report. Clearing the
 * result list on one would blank the dropdown every keystroke.
 */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === 'AbortError' || error.name === 'TimeoutError')
  );
}
