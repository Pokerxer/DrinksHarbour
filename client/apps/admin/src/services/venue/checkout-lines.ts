import { getBill, setLines } from './api';
import type { VenueBill, VenueMode, VenueLine } from './types';
export type VenueInputLine = {
  subProductId: string;
  sizeId: string;
  quantity: number;
  servingVersion?: number;
  choices?: { groupId: string; optionId: string; quantity?: number }[];
  note?: string;
};
export function inputIdentity(line: VenueInputLine) {
  return JSON.stringify([
    line.subProductId,
    line.sizeId,
    (line.choices || [])
      .map((choice) => [choice.groupId, choice.optionId, choice.quantity ?? 1])
      .sort((a, b) => String(a).localeCompare(String(b))),
    line.note || '',
  ]);
}
export function combineVenueQuantities(lines: VenueInputLine[]) {
  const grouped = new Map<string, VenueInputLine>();
  for (const line of lines) {
    const key = inputIdentity(line);
    const previous = grouped.get(key);
    const servingVersion = line.servingVersion ?? previous?.servingVersion;
    grouped.set(key, {
      subProductId: line.subProductId,
      sizeId: line.sizeId,
      quantity: (previous?.quantity || 0) + line.quantity,
      ...(servingVersion !== undefined ? { servingVersion } : {}),
      ...(line.choices?.length ? { choices: line.choices } : {}),
      ...(line.note ? { note: line.note } : {}),
    });
  }
  return Array.from(grouped.values());
}
export function editableVenueLines(lines: VenueLine[]): VenueInputLine[] {
  const extras = new Map<string, number>();
  for (const line of lines)
    for (const choice of line.choiceSnapshots || [])
      if (choice.type === 'addon' && choice.subProductId && choice.sizeId) {
        const key = `${choice.subProductId}:${choice.sizeId}`;
        extras.set(
          key,
          (extras.get(key) || 0) + (choice.quantity ?? 1) * line.quantity,
        );
      }
  const result: VenueInputLine[] = [];
  for (const line of lines) {
    let quantity = line.quantity;
    const key = `${line.subProductId}:${line.sizeId}`;
    if (!line.choices?.length && !line.choiceSnapshots?.length) {
      const remove = Math.min(quantity, extras.get(key) || 0);
      quantity -= remove;
      extras.set(key, (extras.get(key) || 0) - remove);
    }
    if (quantity > 0)
      result.push({
        subProductId: line.subProductId,
        sizeId: line.sizeId,
        quantity,
        ...(line.servingSnapshot
          ? { servingVersion: line.servingSnapshot.servingVersion }
          : {}),
        ...(line.choices?.length ? { choices: line.choices } : {}),
        ...(line.note ? { note: line.note } : {}),
      });
  }
  return combineVenueQuantities(result);
}
export async function saveCheckoutLines(
  token: string,
  sessionId: string,
  body: { expectedVersion: number; lines: VenueInputLine[] },
  mode?: VenueMode,
): Promise<Pick<VenueBill, 'version' | 'lineVersion'>> {
  const bill = await getBill(token, sessionId, mode);
  if (bill.version !== body.expectedVersion || bill.state !== 'open')
    throw new Error('Visit changed; reload this table before checkout.');
  const signature = (lines: VenueInputLine[]) =>
    JSON.stringify(
      combineVenueQuantities(lines)
        .map((line) => ({
          identity: inputIdentity(line),
          quantity: line.quantity,
        }))
        .sort((a, b) => a.identity.localeCompare(b.identity)),
    );
  if (signature(editableVenueLines(bill.lines)) === signature(body.lines))
    return { version: bill.version, lineVersion: bill.lineVersion };
  return setLines(token, sessionId, body, mode);
}
