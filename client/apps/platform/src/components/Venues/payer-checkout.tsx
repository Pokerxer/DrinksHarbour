'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {useAuth} from '@/context/AuthContext';
import {privateVenue,venueKey} from '@/lib/venue/client';
import {PiCheckCircle,PiHourglassBold,PiXCircleBold} from 'react-icons/pi';
type Portion={id:string;amountMinor:number;currency:string;state:string;collectionEnabled?:boolean;expiresAt:string;payment?:{state:string;authorizationUrl?:string;receiptId:string|null}};
const money=(n:number)=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN'}).format(n/100);
export default function PayerCheckout({portionId,token}:{portionId:string;token:string}){
 const {user,isAuthenticated,isLoading}=useAuth();
 const [portion,setPortion]=useState<Portion|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const generation=useRef(0);const [clock,setClock]=useState(Date.now());
 useEffect(()=>{const timer=setInterval(()=>setClock(Date.now()),1000);return()=>clearInterval(timer);},[]);
 const path=`/payers/${encodeURIComponent(portionId)}`;
 const load=useCallback(async()=>{
  if(!isAuthenticated||!user)return;
  const current=++generation.current;setError('');setPortion(null);
  try{const row=await privateVenue<Portion>(`${path}?token=${encodeURIComponent(token)}`);if(current===generation.current)setPortion(row);}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to load your payment. Retry.');}
 },[isAuthenticated,user?._id,path,token]);
 useEffect(()=>{void load();return()=>{generation.current++;};},[load]);
 const redirect=`/venue-pay/${encodeURIComponent(portionId)}?token=${encodeURIComponent(token)}`;
 if(isLoading)return <p role="status">Loading your account…</p>;
 if(!isAuthenticated)return <section><h1 className="text-2xl font-semibold">Pay your portion</h1><a href={`/login?redirect=${encodeURIComponent(redirect)}`}>Sign in to pay your portion</a></section>;
 const applied=portion?.state==='applied';const expired=!!portion&&!portion.payment&&new Date(portion.expiresAt).getTime()<=clock;
 return <section className="mx-auto max-w-xl space-y-5 rounded-2xl border border-stone-200 bg-white p-5 leading-7 text-stone-700 shadow-sm sm:p-8 [&_button]:min-h-12 [&_button]:rounded-xl [&_button]:border [&_button]:border-stone-300 [&_button]:px-4 [&_button]:py-3 [&_button]:font-semibold [&_button]:text-stone-900 [&_button:hover]:bg-stone-50 [&_button:focus-visible]:ring-2 [&_button:focus-visible]:ring-red-800 [&_button:disabled]:cursor-wait [&_button:disabled]:opacity-50 [&_a]:inline-flex [&_a]:min-h-11 [&_a]:items-center [&_a]:font-semibold [&_a]:text-red-800 [&_a]:underline [&_[role=alert]]:rounded-xl [&_[role=alert]]:bg-red-50 [&_[role=alert]]:p-4 [&_[role=alert]]:text-red-800" aria-label="Your bill portion">
  <h1 className="font-[var(--font-kavoon)] text-3xl font-normal text-stone-900">Pay your portion</h1>
  <p>This link covers your allocated amount. Booking changes and refunds remain with the organiser and venue.</p>
  {!portion&&!error&&<p role="status">Loading your portion…</p>}
  {error&&<p role="alert">{error}</p>}
  {portion&&<>
   <p className="rounded-xl bg-stone-950 px-5 py-6 text-3xl font-semibold tabular-nums text-white">{money(portion.amountMinor)} <span className="text-sm font-normal text-stone-300">{portion.currency}</span></p>
   {applied?<p role="status" className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 font-medium text-green-950"><PiCheckCircle size={20} className="mt-1 shrink-0" aria-hidden="true"/>Your payment has been applied to the bill.</p>:<p role="status">{portion.payment?`Payment is ${portion.payment.state}. Check this attempt before paying again.`:`Portion is ${portion.state}.`}</p>}
   <p>Payment window: {new Date(portion.expiresAt).toLocaleString()} (your local time).</p>
   {expired&&<p role="status" className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 font-medium text-amber-900"><PiHourglassBold size={20} className="mt-1 shrink-0" aria-hidden="true"/>This unstarted reservation has expired. Ask the host for a new portion.</p>}
   {portion.state==='failed'&&<p role="status" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 p-4 font-medium text-red-800"><PiXCircleBold size={20} className="mt-1 shrink-0" aria-hidden="true"/>The provider confirmed this attempt failed. The host can reserve a new portion. A later successful payment will still be retained.</p>}
   {!portion.payment&&!applied&&portion.collectionEnabled&&portion.state==='reserved'&&!expired&&<button disabled={busy} onClick={async()=>{
    if(!user)return;const current=generation.current;setBusy(true);setError('');
    try{const body={token,email:user.email};const result=await privateVenue<NonNullable<Portion['payment']>>(`${path}/collect`,'POST',body,await venueKey(`${user._id}:${portionId}:payer`,body));if(current===generation.current){setPortion({...portion,state:'pending',payment:result});if(result.authorizationUrl)window.location.assign(result.authorizationUrl);}}
    catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Unable to start this payment');}finally{if(current===generation.current)setBusy(false);}
   }}>Pay with Paystack · {money(portion.amountMinor)}</button>}
   {portion.payment&&!applied&&<button disabled={busy} onClick={async()=>{
    const current=generation.current;setBusy(true);setError('');try{const row=await privateVenue<Portion>(`${path}/verify`,'POST',{token});if(current===generation.current)setPortion(row);}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Payment remains pending');}finally{if(current===generation.current)setBusy(false);}
   }}>Check payment</button>}
   {!applied&&portion.payment?.authorizationUrl?.startsWith('https://')&&<a referrerPolicy="no-referrer" href={portion.payment.authorizationUrl}>Resume your secure checkout</a>}
  </>}
  <button disabled={busy} onClick={()=>void load()}>Refresh your portion</button>
 </section>;
}
