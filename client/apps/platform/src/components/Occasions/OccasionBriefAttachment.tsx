'use client';

import { useState } from 'react';
import { occasionFileAccept, validateOccasionAttachment } from '@/lib/occasionAttachment';

export default function OccasionBriefAttachment({ file, onChange, disabled }: { file?: File; onChange: (file?: File) => void; disabled: boolean }) {
  const [error, setError] = useState('');
  return <div className="rounded-xl border border-dashed border-rose-200 bg-rose-50/50 p-4"><label htmlFor="occasion-list-file" className="text-xs font-semibold text-[#351014]">Have a drinks list or photo? (optional)</label><input id="occasion-list-file" type="file" accept={occasionFileAccept} disabled={disabled} onChange={event => { const next = event.target.files?.[0]; event.target.value = ''; if (!next) return; const issue = validateOccasionAttachment(next); setError(issue || ''); if (!issue) onChange(next); }} className="mt-3 block w-full min-w-0 text-xs file:mr-2 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-3 file:font-semibold file:text-[#7c1d1d]" />{file && <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="min-w-0 break-all">{file.name}</span><button type="button" disabled={disabled} onClick={() => { onChange(undefined); setError(''); }} className="min-h-10 shrink-0 font-semibold text-[#7c1d1d] underline">Remove file</button></div>}<p className="mt-2 text-[11px] leading-5 text-gray-500">PDF, DOCX, Excel, CSV or text up to 8 MB; JPEG, PNG or WebP up to 5 MB. Included only when you send your request.</p>{error && <p role="alert" className="mt-2 text-xs leading-6 text-red-700">{error}</p>}</div>;
}
