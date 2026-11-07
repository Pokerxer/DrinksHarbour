export function checkoutAttemptKey(storage: Pick<Storage, 'getItem' | 'setItem'>): string;
export function finishCheckoutAttempt(storage: Pick<Storage, 'removeItem'>): void;
