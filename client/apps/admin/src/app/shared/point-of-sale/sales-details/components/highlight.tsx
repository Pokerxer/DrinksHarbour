import type { ReactNode } from 'react';

export function highlight(text: string, q: string): ReactNode {
  if (!q || !text) return text;
  const lower = text.toLowerCase();
  const lowerQ = q.toLowerCase();
  const parts: ReactNode[] = [];
  let last = 0;
  let idx = lower.indexOf(lowerQ);
  while (idx !== -1) {
    if (idx > last) parts.push(text.slice(last, idx));
    parts.push(
      <mark
        key={idx}
        className="rounded-[2px] bg-yellow-100 px-px not-italic text-yellow-900"
      >
        {text.slice(idx, idx + q.length)}
      </mark>
    );
    last = idx + q.length;
    idx = lower.indexOf(lowerQ, last);
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}