// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import CapacityReschedule from './capacity-reschedule';
import type {RequestRow} from '@/services/venue/experience';
afterEach(cleanup);
it('reviews replacement capacity before atomically amending an accepted booking',async()=>{
 const row:RequestRow={id:'booking',reference:'VR',status:'confirmed',statusLabel:'Confirmed',requestState:'reviewed',version:2,bookingAt:'2026-12-01T19:00:00.000Z',partySize:2,guest:{name:'Guest',phone:'123'},locationId:'location',serviceSessionId:null,policy:{timezone:'Africa/Lagos',policies:'Review',locationName:'Bar',venueName:'Venue'}};
 const load=vi.fn().mockResolvedValue({policyVersion:3,options:[{resourceIds:['table']}],asOf:new Date().toISOString(),durationMinutes:60,timezone:'Africa/Lagos'}),accept=vi.fn().mockResolvedValue(false);
 render(<CapacityReschedule row={row} tables={[{_id:'table',name:'Table 1'}]} busy={false} load={load} accept={accept}/>);
 fireEvent.click(screen.getByRole('button',{name:'Review booking change'}));fireEvent.change(screen.getByLabelText('New venue-local booking time'),{target:{value:'2026-12-01T21:00'}});
 expect(accept).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'Check booking availability'}));await screen.findByLabelText('Available tables');
 expect(load).toHaveBeenCalledWith(expect.objectContaining({bookingAt:'2026-12-01T20:00:00.000Z',partySize:2}));
 fireEvent.change(screen.getByLabelText('Available tables'),{target:{value:'0'}});fireEvent.click(screen.getByRole('button',{name:'Accept booking'}));
 await waitFor(()=>expect(accept).toHaveBeenCalledWith({resourceIds:['table'],policyVersion:3,amendment:{guest:row.guest,partySize:2,bookingAt:'2026-12-01T20:00:00.000Z'}}));
 expect(await screen.findByText(/Booking changed or tables were taken/)).toBeTruthy();expect(screen.getByText(/The existing commitment stays valid/)).toBeTruthy();
});
