/**
 * Acting on the assistant's cart offer — the parts worth asserting.
 *
 * Ported from `ChatbotWidget.tsx:619-683`. The fetch-and-add loop itself is
 * I/O and lives in the screen; the quantity clamp and the confirmation copy are
 * here because getting either wrong is invisible until a real order is wrong.
 */

export interface ProposedSize {
  stock?: number;
  minOrderQuantity?: number;
  maxOrderQuantity?: number;
}

/**
 * What the shopper actually gets, given what the model proposed and what the
 * size allows. The minimum is applied LAST so a size sold only in sixes cannot
 * be added as a single bottle.
 */
export function clampProposedQuantity(proposed: number | undefined, size: ProposedSize): number {
  const wanted = Math.max(proposed || 1, 1);
  const ceiling = size.maxOrderQuantity || size.stock || 99;
  return Math.max(Math.min(wanted, ceiling), size.minOrderQuantity || 1);
}

export function describeAddedLine(quantity: number, name: string, size: string): string {
  return `${quantity} × **${name}**${size ? ` (${size})` : ''}`;
}

/** The assistant's own read-back. `added` entries come from `describeAddedLine`. */
export function buildCartConfirmation(added: string[], failed: string[]): string {
  const names = (list: string[]) => list.map((f) => `**${f}**`).join(', ');

  if (!added.length) {
    // Never claim success when nothing went in — and do not offer a cart link
    // to a cart this exchange did not change.
    return `⚠️ Sorry — I couldn't add ${names(failed)} to your cart right now. You can open the product page and add it from there.`;
  }

  let message =
    `✅ Done! Added to your cart:\n${added.map((a) => `• ${a}`).join('\n')}\n\n` +
    `[View cart](/cart) when you're ready to checkout, or keep chatting — happy to suggest a pairing! 🍷`;

  if (failed.length) {
    message += `\n\n⚠️ I couldn't add ${names(failed)} — currently unavailable.`;
  }

  return message;
}
