export const fmt = (n: number) =>
  `₦${Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const fmtDate = (iso: string) =>
  iso
    ? new Date(iso).toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : '—';
export const fmtTime = (iso: string) =>
  iso
    ? new Date(iso).toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      })
    : '';
export const fmtDateTime = (iso: string) =>
  iso ? `${fmtDate(iso)} · ${fmtTime(iso)}` : '—';
