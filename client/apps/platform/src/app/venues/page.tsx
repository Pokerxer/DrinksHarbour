import VenuesDirectory from '@/components/Venues/VenuesDirectory';
import VenueDirectory from '@/components/Venues/venue-directory';
export default async function VenuesPage({searchParams}:{searchParams:Promise<Record<string,string|undefined>>}) {
 if(process.env.VENUE_EXPERIENCE_ENABLED!=='true')return <VenuesDirectory/>;
 return <VenueDirectory query={await searchParams}/>;
}
