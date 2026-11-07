// @vitest-environment jsdom
import {cleanup,render,screen,within} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import BookingsPage from '@/app/(hydrogen)/bookings/page';
vi.mock('@/hooks/use-authorization',()=>({useAuthToken:()=> 'test'}));
vi.mock('./table-checkout',()=>({default:()=>null}));
vi.mock('./booking-seat',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('directs request-only reservations to versioned review while preserving legacy booking actions',async()=>{
 const base={partySize:2,bookingAt:'2026-11-01T19:00:00Z',status:'pending'};
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({data:[{...base,_id:'request',requestMode:'request_only',requestPolicy:{timezone:'Africa/Lagos'},guest:{name:'Requested Guest',phone:'123'}},{...base,_id:'legacy',guest:{name:'Legacy Guest',phone:'456'}}]}))));
 render(<BookingsPage/>);
 const requested=(await screen.findByText('Requested Guest')).closest('li')!;
 expect(requested.textContent).toContain('Africa/Lagos');
 expect(within(requested).queryByRole('button',{name:'confirmed'})).toBeNull();
 expect(within(requested).getByRole('link',{name:'Review in venue workspace'}).getAttribute('href')).toBe('/venue');
 expect(screen.getByRole('button',{name:'confirmed'})).toBeTruthy();
});
