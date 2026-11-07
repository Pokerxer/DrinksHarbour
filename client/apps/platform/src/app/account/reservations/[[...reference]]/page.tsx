import {redirect} from 'next/navigation';
export default async function LegacyReservationPath({params}:{params:Promise<{reference?:string[]}>}){const {reference}=await params;redirect(`/my-account/reservations${reference?.length?`/${encodeURIComponent(reference[0])}`:''}`);}
