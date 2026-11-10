'use client';

/** Honest delivery ticks for outgoing bubbles (WhatsApp grammar, DrinksHarbour
 * brand). `read` requires the server watermark — see lib/chatStatus
 * chatReadState. Nothing here can render a state the server did not prove:
 * callers pass only 'sent' or 'read'. */
export type ChatTickReadonlyProps = { state: 'sent' | 'read' };
const STROKE = '#7c1d1d';
const SingleCheck = () => (
  <svg aria-hidden="true" viewBox="0 0 16 12" className="h-3 w-4" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6.5 5.2 9.8 12 2.6" />
  </svg>
);
const DoubleCheck = () => (
  <svg aria-hidden="true" viewBox="0 0 22 12" className="h-3 w-6" fill="none" stroke={STROKE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 6.5 5.2 9.8 12 2.6" />
    <path d="M9 6.5 12.2 9.8 19 2.6" />
  </svg>
);
export default function ChatTicks({ state }: ChatTickReadonlyProps) {
  return <span className="inline-flex items-center" title={state === 'read' ? 'Our team has this conversation open.' : 'Sent.'}>
    <span className="sr-only">{state === 'read' ? 'Our team has this conversation open.' : 'Sent.'}</span>
    {state === 'read' ? <DoubleCheck /> : <SingleCheck />}
  </span>;
}
