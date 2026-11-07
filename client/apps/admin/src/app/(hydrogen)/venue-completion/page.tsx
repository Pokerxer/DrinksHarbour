import VenueCompletion from '@/app/shared/venue/venue-completion';
export default async function VenueCompletionPage({searchParams}:{searchParams:Promise<{visit?:string}>}){return <VenueCompletion initialVisit={(await searchParams).visit}/>;}
