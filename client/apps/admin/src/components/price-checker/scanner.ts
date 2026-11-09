export function validBarcode(value: string): string | null {
  const code = value.trim();
  return code.length >= 5 && code.length <= 128 && !/[\x00-\x1f\x7f]/.test(code)
    ? code
    : null;
}

interface ScannerOptions {
  /** Silence window that fires an idle decode — for wedges configured
   *  without a suffix terminator (None mode). */
  idleDecodeMs?: number;
  onIdleDecode?: (code: string) => void;
}

/** Leading GS1 AIM symbology identifiers (]C1, ]E0, ]Q3, …) delivered by
 *  scanner firmware options — stripped, never treated as barcode data. */
export function stripAimPrefix(value: string): string {
  const match = /^\][A-Z][0-9]?/.exec(value);
  if (!match) return value;
  const remainder = value.slice(match[0].length);
  return remainder.length >= 5 ? remainder : value;
}

/** Idle decodes are unverified (no terminator was sent), so only bursts that
 *  look like real barcodes (≥8 chars, at least one digit) are trusted. */
function plausibleIdleCode(code: string): boolean {
  return code.length >= 8 && /\d/.test(code);
}

export function createScanner(options: ScannerOptions = {}) {
  const idleDecodeMs = options.idleDecodeMs ?? 0;
  let buffer = '',
    overflow = false,
    lastKey = 0,
    lastCode = '',
    lastScan = -Infinity,
    idle: ReturnType<typeof setTimeout> | undefined;
  const cancelIdle = () => {
    if (idle !== undefined) {
      clearTimeout(idle);
      idle = undefined;
    }
  };
  const decode = (now: number): string | null => {
    const code = overflow ? null : validBarcode(stripAimPrefix(buffer));
    buffer = '';
    overflow = false;
    if (!code) return null;
    if (code === lastCode && now - lastScan < 700) return null;
    lastCode = code;
    lastScan = now;
    return code;
  };
  return {
    clear() {
      buffer = '';
      overflow = false;
      cancelIdle();
    },
    feed(key: string, now: number): string | null {
      if (now - lastKey > 1000) {
        buffer = '';
        overflow = false;
      }
      cancelIdle();
      if (key === 'Enter' || key === 'Tab') {
        return decode(now);
      }
      if (key === 'Escape') {
        buffer = '';
        overflow = false;
        return null;
      }
      if (key === 'Backspace') {
        buffer = buffer.slice(0, -1);
      } else if (key.length === 1) {
        lastKey = now;
        if (!overflow) buffer += key;
      } else {
        // Modifier/arrow noise from human hands — never part of a burst.
        return null;
      }
      if (buffer.length > 128) {
        buffer = '';
        overflow = true;
      }
      if (idleDecodeMs > 0) {
        idle = setTimeout(() => {
          idle = undefined;
          const code = overflow ? null : validBarcode(stripAimPrefix(buffer));
          if (code && plausibleIdleCode(code)) {
            if (code === lastCode && now - lastScan < 700) return;
            lastCode = code;
            lastScan = now;
            buffer = '';
            overflow = false;
            options.onIdleDecode?.(code);
            return;
          }
          // Not a plausible barcode (junk/short text) — discard quietly.
          buffer = '';
          overflow = false;
        }, idleDecodeMs);
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
