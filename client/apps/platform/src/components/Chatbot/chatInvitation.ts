export const INVITATION_KEY = 'dh-chat-invitation-seen-v1';
export const INVITATION_DELAY_MS = 5000;
type SessionStorage = Pick<Storage, 'getItem' | 'setItem'> | null;

export function rememberInvitation(storage: SessionStorage) {
  try { storage?.setItem(INVITATION_KEY, '1'); } catch { /* Storage can be blocked. */ }
}

export function scheduleInvitation(storage: SessionStorage, show: () => void) {
  try {
    if (storage?.getItem(INVITATION_KEY) === '1') return () => {};
  } catch { /* The launcher still works without persistence. */ }
  const timer = setTimeout(() => {
    rememberInvitation(storage);
    show();
  }, INVITATION_DELAY_MS);
  return () => clearTimeout(timer);
}
