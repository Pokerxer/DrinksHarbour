'use client';
import { useEffect, useRef, useState } from 'react';
import type { Reservation } from '@/lib/venue/types';
import { privateVenue, venueKey } from '@/lib/venue/client';
import { PiSpinner } from 'react-icons/pi';
type Attempt = {state:string;amountMinor:number;currency:string;authorizationUrl?:string;receiptId:string|null};
const money=(minor:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(minor/100);
export default function BookingDeposit({row,identity,email,onRefresh}:{row:Reservation;identity:string;email:string;onRefresh:()=>void}) {
 const quote=row.payment;
 const [attempt,setAttempt]=useState<Attempt|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[agreed,setAgreed]=useState(false),[clock,setClock]=useState(Date.now());
 const epoch=useRef(0);
 useEffect(()=>{const current=++epoch.current;void privateVenue<Attempt|null>(`/me/requests/${row.reference}/deposit`).then(value=>{if(current===epoch.current)setAttempt(value);}).catch(e=>{if(current===epoch.current)setError(e instanceof Error?e.message:'Unable to load deposit');});const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{epoch.current++;clearInterval(timer);};},[identity,row.reference]);
 if(!quote||(!quote.depositMinor&&!quote.minimumMinor))return null;
 const expired=!!quote.depositMinor&&(!quote.deadline||clock>=new Date(quote.deadline).getTime());
 const received=!!attempt?.receiptId||['deposit_received','paid_needs_resolution'].includes(quote.state);
 const pending=!!attempt&&!received;
 return <section aria-label="Booking deposit" className="space-y-4 rounded-2xl border border-stone-200 bg-stone-50 p-5 text-sm leading-7 text-stone-700 [&_button]:min-h-11 [&_button]:rounded-xl [&_button]:border [&_button]:border-stone-300 [&_button]:bg-white [&_button]:px-4 [&_button]:py-2 [&_button]:font-semibold [&_button]:text-stone-900 [&_button:hover]:border-red-800 [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-red-800 [&_button:disabled]:cursor-not-allowed [&_button:disabled]:opacity-50 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:font-semibold [&_a]:text-red-800 [&_a]:underline [&_[role=alert]]:rounded-xl [&_[role=alert]]:bg-red-50 [&_[role=alert]]:p-3 [&_[role=alert]]:text-red-800">
  <h3 className="font-semibold">Booking financial terms</h3>
  {!!quote.minimumMinor&&<><p>Minimum eligible spend: {money(quote.minimumMinor)}</p><p>{quote.minimumTerms}</p><p>Eligibility: net discounted merchandise. Deposits do not count as consumption. Excluded item references: {quote.excludedSubProductIds?.join(', ')||'None'}. Any shortfall appears separately as a service charge; its approved tax rate is {quote.shortfallTaxRate}%.</p></>}
  <p>This advance counts towards your final bill. Excess credit remains available for approved resolution.</p>
  <p>Currency: {quote.currency}. Due now: {received?'Received':money(quote.depositMinor)}.</p>
  {!expired&&!received&&quote.deadline&&<p>Time remaining: {Math.floor((new Date(quote.deadline).getTime()-clock)/60000)} minutes {Math.floor((new Date(quote.deadline).getTime()-clock)/1000)%60} seconds.</p>}
  {quote.deadline&&<p>Payment deadline: {new Intl.DateTimeFormat('en-NG',{dateStyle:'medium',timeStyle:'short',timeZone:row.policy.timezone}).format(new Date(quote.deadline))} · {row.policy.timezone}</p>}
  {quote.appliedCreditMinor!==undefined&&<p>Applied bill credit: {money(quote.appliedCreditMinor)} · Unapplied credit: {money(quote.unappliedCreditMinor||0)}</p>}
  {!quote.collectionEnabled&&!received&&<p>New deposit collection is paused. Existing payments can still be checked.</p>}
  <p>{quote.cancellationTerms}</p><p>{quote.noShowTerms}</p><p>{quote.excessCreditTerms}</p>
  {quote.state==='paid_needs_resolution'&&<p role="status">Payment received. The venue must review capacity or credit. A refund has not been confirmed.</p>}
  {received&&quote.state!=='paid_needs_resolution'&&<p role="status">Deposit received. Refresh the booking for current confirmation and bill credit.</p>}
  {expired&&!received&&<p role="status">The payment window has expired. Check any payment already started before asking the venue for a new arrangement.</p>}
  {pending&&<p role="status">Payment is {attempt.state}. Check this attempt before trying another payment.</p>}
  {!attempt&&!received&&!expired&&quote.collectionEnabled&&(!quote.termsAccepted||!!quote.depositMinor)&&row.status==='confirmed'&&<>
   <label className="flex min-h-11 cursor-pointer items-start gap-3"><input type="checkbox" className="mt-1.5 h-5 w-5 shrink-0 accent-red-800" checked={agreed} onChange={e=>setAgreed(e.target.checked)}/>I accept these booking, deposit, minimum-spend and cancellation terms.</label>
   <button disabled={busy||!agreed||!email} onClick={async()=>{const current=epoch.current;setBusy(true);setError('');try{
    const body={...(quote.depositMinor?{email}:{}),acceptedTerms:true,expectedVersion:row.version,policyVersion:quote.policyVersion};
    const value=await privateVenue<Attempt>(`/me/requests/${row.reference}/${quote.depositMinor?'deposit':'financial-terms'}`,'POST',body,await venueKey(`${identity}:${row.reference}:deposit`,body));
    if(current===epoch.current){if(!quote.depositMinor){onRefresh();return;}setAttempt(value);if(value.authorizationUrl)window.location.assign(value.authorizationUrl);}
   }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Unable to start deposit');}finally{if(current===epoch.current)setBusy(false);}}}><span className="inline-flex items-center gap-2">{busy&&<PiSpinner size={18} aria-hidden="true" className="motion-safe:animate-spin"/>}{busy?(quote.depositMinor?'Starting payment…':'Saving your acceptance…'):(quote.depositMinor?'Pay deposit with Paystack':'Accept booking financial terms')}</span></button>
  </>}
  {pending&&!expired&&attempt.authorizationUrl?.startsWith('https://')&&<a referrerPolicy="no-referrer" href={attempt.authorizationUrl}>Resume secure deposit checkout</a>}
  {attempt&&<button disabled={busy} onClick={async()=>{const current=epoch.current;setBusy(true);setError('');try{await privateVenue(`/me/requests/${row.reference}/deposit/verify`,'POST',{});if(current===epoch.current)onRefresh();}catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Payment remains pending');}finally{if(current===epoch.current)setBusy(false);}}}><span className="inline-flex items-center gap-2">{busy&&<PiSpinner size={18} aria-hidden="true" className="motion-safe:animate-spin"/>}{busy?'Checking payment…':'Check deposit payment'}</span></button>}
  {error&&<p role="alert">{error}</p>}
 </section>;
}
