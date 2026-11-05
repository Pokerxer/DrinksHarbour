export function validBarcode(value: string): string | null {
  const code = value.trim();
  return code.length >= 5 && code.length <= 128 && !/[\x00-\x1f\x7f]/.test(code)
    ? code
    : null;
}
export function createScanner() {
  let buffer = '',
    overflow = false,
    lastKey = 0,
    lastCode = '',
    lastScan = -Infinity;
  return {
    clear() {
      buffer = '';
      overflow = false;
    },
    feed(key: string, now: number): string | null {
      if (now - lastKey > 1000) {
        buffer = '';
        overflow = false;
      }
      if (key === 'Enter') {
        const code = overflow ? null : validBarcode(buffer);
        buffer = '';
        overflow = false;
        if (!code || (code === lastCode && now - lastScan < 700)) return null;
        lastCode = code;
        lastScan = now;
        return code;
      }
      if (key === 'Escape') {
        buffer = '';
        overflow = false;
      }
      if (key === 'Backspace') buffer = buffer.slice(0, -1);
      if (key.length === 1) {
        lastKey = now;
        if (!overflow) buffer += key;
      }
      if (buffer.length > 128) {
        buffer = '';
        overflow = true;
      }
      return null;
    },
  };
}
export function latestScan() {
  let generation = 0;
  return {
    begin: () => ++generation,
    isCurrent: (value: number) => value === generation,
  };
}
