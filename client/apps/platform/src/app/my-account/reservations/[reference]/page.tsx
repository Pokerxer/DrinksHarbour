import OwnedRequests from '@/components/Venues/owned-requests';
export default async function ReservationPage({params}:{params:Promise<{reference:string}>}){return <OwnedRequests reference={(await params).reference}/>;}
