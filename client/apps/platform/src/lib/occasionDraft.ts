import type { DrinkCategoryPreference } from './occasionGeneration';

/**
 * Client-side occasion plan draft, one object per occasion page
 * (`drinksharbour-occasion-draft:<key>` in localStorage).
 *
 * Persisted: category preferences, quantity list entries, the hub occasion
 * choice and the honest-op text fields. Deliberately NOT persisted:
 * - the attachment File (device storage is not a file transport; the customer
 *   re-adds it before sending — the page advertises this),
 * - name, email and WhatsApp (contact identifiers stay out of unencrypted
 *   device storage and the reply channel must be re-typed and re-consented
 *   on each send),
 * - the consent checkbox (consent must be an affirmative choice every time,
 *   never a restored state).
 * All functions are no-ops server-side and swallow storage errors so a
 * private-browsing or full-storage device only loses the draft, never fails.
 */

export type OccasionDraftFields = { channel: 'email' | 'whatsapp'; city: string; date: string; guests: string; budget: string; notes: string };
type DraftItem = { productId?: string; name: string; quantity: string; unit: 'bottles' | 'cans' | 'cases'; size: string; id: string };

const UNITS = ['bottles', 'cans', 'cases'] as const;

function sanitizeItems(value: unknown): DraftItem[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const items = value
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object' && typeof (entry as Record<string, unknown>).name === 'string' && !!String((entry as Record<string, unknown>).name).trim())
    .map(entry => ({
      id: text(entry.id, 64) || `restored-${Math.random().toString(36).slice(2, 10)}`,
      name: text(entry.name, 120),
      quantity: typeof entry.quantity === 'string' && /^\d+$/.test(entry.quantity) && Number(entry.quantity) <= 9999 ? entry.quantity : '1',
      unit: (UNITS as readonly string[]).includes(entry.unit as string) ? entry.unit as DraftItem['unit'] : 'bottles',
      size: text(entry.size, 60),
      ...(typeof entry.productId === 'string' && entry.productId ? { productId: entry.productId } : {}),
    }))
    .filter(entry => entry.name);
  return items.length ? items.slice(0, 20) : undefined;
}

export type OccasionDraft = {
  occasion?: string;
  fields?: OccasionDraftFields;
  preferences?: DrinkCategoryPreference[];
  items?: DraftItem[];
  savedAt?: string;
};

const PREFERENCE_IDS: DrinkCategoryPreference[] = ['toast', 'wine', 'beer', 'spirits', 'alcohol-free'];
const CHANNELS = ['email', 'whatsapp'];
const key = (draftKey: string | null) => (draftKey || 'general').trim();
const text = (value: unknown, limit: number) => typeof value === 'string' && value ? value.slice(0, limit) : '';

/** Reads and re-validates the draft; an unreadable entry simply returns null. */
export function readOccasionDraft(draftKey: string | null): OccasionDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(`drinksharbour-occasion-draft:${key(draftKey)}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as Record<string, unknown>;
    if (!value || typeof value !== 'object') return null;
    const draft: OccasionDraft = {};
    if (typeof value.occasion === 'string') draft.occasion = value.occasion;
    if (value.savedAt && typeof value.savedAt === 'string') draft.savedAt = value.savedAt;
    const preferences = Array.isArray(value.preferences) ? value.preferences.filter(id => PREFERENCE_IDS.includes(id as DrinkCategoryPreference)) as DrinkCategoryPreference[] : [];
    if (preferences.length) draft.preferences = preferences;
    const items = sanitizeItems(value.items);
    if (items) draft.items = items;
    if (value.fields && typeof value.fields === 'object') {
      const fields = value.fields as Record<string, unknown>;
      draft.fields = {
        channel: CHANNELS.includes(fields.channel as 'email') ? fields.channel as 'email' | 'whatsapp' : 'email',
        city: text(fields.city, 80),
        date: text(fields.date, 10),
        guests: text(fields.guests, 12),
        budget: text(fields.budget, 14),
        notes: text(fields.notes, 500),
      };
    }
    return draft.occasion || draft.fields || draft.preferences?.length || draft.items?.length ? draft : null;
  } catch {
    return null;
  }
}

/** Merges patch into the draft; only provided, validated keys are written. */
export function writeOccasionDraft(draftKey: string | null, patch: OccasionDraft): void {
  if (typeof window === 'undefined') return;
  const existing = readOccasionDraft(draftKey) ?? {};
  const next: OccasionDraft = { ...existing, savedAt: new Date().toISOString() };
  if (patch.occasion !== undefined) next.occasion = patch.occasion;
  if (patch.fields !== undefined) next.fields = patch.fields;
  if (patch.preferences !== undefined) next.preferences = patch.preferences;
  if (patch.items !== undefined) next.items = patch.items;
  try {
    window.localStorage.setItem(`drinksharbour-occasion-draft:${key(draftKey)}`, JSON.stringify(next));
  } catch {
    /* device storage full or blocked — the plan stays usable, only unsaved */
  }
}

/** Hard-clears the whole draft for the key (Send another / explicit clear). */
export function clearOccasionDraft(draftKey: string | null): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(`drinksharbour-occasion-draft:${key(draftKey)}`);
  } catch {
    /* ignore */
  }
}

export type OccasionDraftItem = DraftItem;
