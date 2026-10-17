// Keep a failed/lost response retry attached to its original server operation.
// Store only a digest and random identity, never the sale/customer payload.
const pending = new Map<string, { fingerprint: string; requestId: string }>();
function fingerprint(value: unknown) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `${text.length}:${hash >>> 0}`;
}
export function requestIdentity(scope: string, payload: unknown): string {
  const key = `sales-operation:${scope}`;
  const digest = fingerprint(payload);
  let previous = pending.get(key);
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(key) || 'null');
    if (saved && typeof saved === 'object' && 'fingerprint' in saved && 'requestId' in saved &&
        typeof saved.fingerprint === 'string' && typeof saved.requestId === 'string') previous = saved as typeof previous;
  } catch {}
  if (previous?.fingerprint === digest) return previous.requestId;
  const next = { fingerprint: digest, requestId: globalThis.crypto?.randomUUID?.() || `sale-${Date.now()}-${Math.random().toString(36).slice(2)}` };
  pending.set(key, next);
  try { sessionStorage.setItem(key, JSON.stringify(next)); } catch {}
  return next.requestId;
}
export function completeRequest(scope: string) {
  const key = `sales-operation:${scope}`;
  pending.delete(key);
  try { sessionStorage.removeItem(key); } catch {}
}
