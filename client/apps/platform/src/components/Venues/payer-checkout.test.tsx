import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import PayerCheckout from './payer-checkout';
const {api,auth}=vi.hoisted(()=>({api:vi.fn(),auth:{user:{_id:'payer',email:'payer@example.test'},isAuthenticated:true,isLoading:false}}));
vi.mock('@/context/AuthContext',()=>({useAuth:()=>auth}));
vi.mock('@/lib/venue/client',()=>({privateVenue:api,venueKey:async()=> 'retained-key'}));
afterEach(()=>{cleanup();api.mockReset();auth.isAuthenticated=true;});
it('recovers a pending payer receipt without starting another payment or exposing organiser data',async()=>{
 api.mockResolvedValueOnce({id:'portion',amountMinor:200000,currency:'NGN',state:'pending',collectionEnabled:true,expiresAt:new Date(Date.now()+60000).toISOString(),payment:{state:'needs_review',receiptId:null}}).mockResolvedValueOnce({id:'portion',amountMinor:200000,currency:'NGN',state:'applied',expiresAt:new Date(Date.now()+60000).toISOString(),payment:{state:'settled',receiptId:'receipt'}});
 render(<PayerCheckout portionId="portion" token="grant"/>);
 await screen.findByRole('button',{name:'Check payment'});
 expect(screen.queryByRole('button',{name:/Pay with Paystack/})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Check payment'}));
 await screen.findByText('Your payment has been applied to the bill.');
 expect(api.mock.calls.some(call=>String(call[0]).endsWith('/collect'))).toBe(false);
});
it('preserves the scoped entry through sign-in',async()=>{
 auth.isAuthenticated=false;
 render(<PayerCheckout portionId="portion" token="grant"/>);
 expect(screen.getByRole('link',{name:'Sign in to pay your portion'}).getAttribute('href')).toContain('redirect=%2Fvenue-pay%2Fportion%3Ftoken%3Dgrant');
 await waitFor(()=>expect(api).not.toHaveBeenCalled());
});
it('expires the unstarted checkout visibly while keeping initiated payment recovery available',async()=>{
 vi.useFakeTimers();vi.setSystemTime(new Date('2026-12-01T12:00:00Z'));
 api.mockResolvedValue({id:'portion',amountMinor:100000,currency:'NGN',state:'reserved',collectionEnabled:true,expiresAt:'2026-12-01T12:00:01Z'});
 try{
  const {act}=await import('@testing-library/react');render(<PayerCheckout portionId="portion" token="grant"/>);await act(async()=>{await Promise.resolve();});
  expect(screen.getByRole('button',{name:/Pay with Paystack/})).toBeTruthy();await act(async()=>{vi.advanceTimersByTime(2000);});
  expect(screen.queryByRole('button',{name:/Pay with Paystack/})).toBeNull();expect(screen.getByText(/reservation has expired/)).toBeTruthy();
 }finally{vi.useRealTimers();}
});
