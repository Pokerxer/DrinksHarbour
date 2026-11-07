import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import Availability from './availability';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('checks current capacity but never promises confirmation',async()=>{
 const fetcher=vi.fn().mockResolvedValue(new Response(JSON.stringify({data:{available:true,asOf:new Date().toISOString(),durationMinutes:60}})));vi.stubGlobal('fetch',fetcher);
 render(<Availability slug="venue" locationSlug="bar" wall="2026-12-01T20:00" timezone="Africa/Lagos" partySize={3}/>);
 fireEvent.click(screen.getByRole('button',{name:'Check current availability'}));
 expect(await screen.findByText(/Capacity is available now/)).toBeTruthy();
 expect(screen.getByText(/Staff must still accept/)).toBeTruthy();
 expect(fetcher.mock.calls[0][0]).toContain('bookingAt=2026-12-01T19%3A00%3A00.000Z');
 expect(fetcher.mock.calls[0][1].cache).toBe('no-store');
});
it('explains invalid party sizes without sending an availability request',async()=>{
 const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);
 render(<Availability slug="venue" locationSlug="bar" wall="2026-12-01T20:00" timezone="Africa/Lagos" partySize={0}/>);
 fireEvent.click(screen.getByRole('button',{name:'Check current availability'}));
 expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Choose between 1 and 100 guests before checking availability.');
 expect(fetcher).not.toHaveBeenCalled();
});
