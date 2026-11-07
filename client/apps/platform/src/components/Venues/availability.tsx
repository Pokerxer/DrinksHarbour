'use client';
import {useEffect,useRef,useState} from 'react';
import {venueLocalToInstant} from 'commerce-core';
const API=process.env.NEXT_PUBLIC_API_URL||'http://localhost:5001';
type Tone='good'|'full'|'info';
const toneClass:Record<Tone,string>={good:'text-green-800',full:'text-amber-900',info:'text-stone-700'};
export default function Availability({slug,locationSlug,wall,timezone,partySize}:{slug:string;locationSlug:string;wall:string;timezone:string;partySize:number}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState<{tone:Tone;text:string}|null>(null),[error,setError]=useState('');const epoch=useRef(0);
 useEffect(()=>{epoch.current++;setMessage(null);setError('');setBusy(false);return()=>{epoch.current++;};},[slug,locationSlug,wall,timezone,partySize]);
 return <section aria-label="Current table availability" className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
  <p>Check capacity for your selected time. The venue still needs to confirm your request.</p>
  <button type="button" className="min-h-11 rounded-xl border border-stone-300 bg-white px-4 py-2 font-semibold text-stone-900 transition hover:border-red-800 hover:text-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-800 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60" disabled={busy} onClick={async()=>{const current=epoch.current;setBusy(true);setError('');setMessage(null);try{
   if(!Number.isInteger(partySize)||partySize<1||partySize>100)throw new Error('Choose between 1 and 100 guests before checking availability.');
   const query=new URLSearchParams({bookingAt:venueLocalToInstant(wall,timezone),partySize:String(partySize)});
   const response=await fetch(`${API}/api/venue-experience/public/${encodeURIComponent(slug)}/${encodeURIComponent(locationSlug)}/availability?${query}`,{cache:'no-store'});
   if(response.status===404){if(current===epoch.current)setMessage({tone:'info',text:'Live availability is not enabled here. Staff will review your request.'});return;}
   const value=await response.json() as {data:{available:boolean;durationMinutes:number};message?:string};if(!response.ok)throw new Error(value.message||'Unable to check availability');
   if(current===epoch.current)setMessage(value.data.available?{tone:'good',text:`Capacity is available now for ${value.data.durationMinutes} minutes. Staff must still accept your request before confirmation or payment.`}:{tone:'full',text:'No capacity is currently available at this time. Choose another time or ask the venue to review.'});
  }catch(e){if(current===epoch.current)setError(e instanceof Error?e.message:'Unable to check availability');}finally{if(current===epoch.current)setBusy(false);}}}>{busy?'Checking…':'Check current availability'}</button>
  {message&&<p role="status" className={`font-medium leading-6 ${toneClass[message.tone]}`}>{message.text}</p>}{error&&<p role="alert" className="font-medium text-red-800">{error}</p>}
 </section>;
}
