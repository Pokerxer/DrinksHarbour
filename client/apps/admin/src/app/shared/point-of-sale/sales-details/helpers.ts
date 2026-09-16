export function isTokenExpired(tok: string | null | undefined): boolean {
  if (!tok) return true;
  try {
    const payload = JSON.parse(atob(tok.split('.')[1]));
    return (
      !payload ||
      typeof payload !== 'object' ||
      !('exp' in payload) ||
      typeof payload.exp !== 'number' ||
      payload.exp * 1000 < Date.now()
    );
  } catch {
    return true;
  }
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function fmtDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

/** Convert a date string + time string to a local-time timestamp (fixes UTC offset bug). */
export function toTsUtc(date: string, time: string): number {
  if (!date) return 0;
  const [y, m, d] = date.split('-').map(Number);
  const [hh, mm] = (time || '00:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm).getTime();
}