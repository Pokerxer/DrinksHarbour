import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import BookingDeposit from './booking-deposit';
import type {Reservation} from '@/lib/venue/types';
const {api}=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/lib/venue/client',()=>({privateVenue:api,venueKey:async()=> 'consent-key'}));
afterEach(()=>{cleanup();api.mockReset();});
it('discloses a minimum with no deposit and requires explicit consent to the current version',async()=>{
 api.mockResolvedValue(null);
 const row:Reservation={id:'booking',statusLabel:'Confirmed',requestState:'reviewed',bookingAt:new Date().toISOString(),partySize:2,guest:{name:'Guest',phone:'123'},locationId:'location',serviceSessionId:null,reference:'VR-minimum',status:'confirmed',version:3,policy:{timezone:'Africa/Lagos',policies:'Review',locationName:'Bar',venueName:'Venue'},payment:{state:'none',policyVersion:2,currency:'NGN',depositMinor:0,minimumMinor:20000000,minimumTerms:'Eligible net beverage spend; shortfall is a service charge',eligibility:'merchandise_net',excludedSubProductIds:[],shortfallClassification:'service_shortfall',shortfallTaxRate:0,termsAccepted:false,deadline:null,cancellationTerms:'Review',noShowTerms:'Review',excessCreditTerms:'Review',collectionEnabled:true}};
 render(<BookingDeposit row={row} identity="customer" email="guest@example.test" onRefresh={()=>{}}/>);
 expect(screen.getByText(/Eligible net beverage spend/)).toBeTruthy();
 const button=screen.getByRole('button',{name:'Accept booking financial terms'});
 expect((button as HTMLButtonElement).disabled).toBe(true);
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(button);
 await waitFor(()=>expect(api).toHaveBeenCalledWith('/me/requests/VR-minimum/financial-terms','POST',{acceptedTerms:true,expectedVersion:3,policyVersion:2},'consent-key'));
 expect(api.mock.calls.some(call=>String(call[0]).endsWith('/deposit')&&call[1]==='POST')).toBe(false);
});
