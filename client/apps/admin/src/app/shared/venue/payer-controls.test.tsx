// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import PayerControls from './payer-controls';
const {api}=vi.hoisted(()=>({api:vi.fn()}));
vi.mock('@/services/venue/experience',()=>({experienceRequest:api}));
afterEach(()=>{cleanup();api.mockReset();});
it('creates exact equal portions on the same visit and shows scoped payer links',async()=>{
 api.mockResolvedValue({version:5,portions:[{id:'portion',token:'scoped',amountMinor:333334,currency:'NGN',state:'reserved',expiresAt:new Date(Date.now()+60000).toISOString()}]});
 render(<PayerControls token="owner" bill={{sessionId:'visit',locationId:'location',version:4,lineVersion:1,state:'unpaid',lines:[],moneyEnabled:true,totalMinor:1000000,outstandingMinor:1000000}} onRefresh={()=>{}}/>);
 fireEvent.change(screen.getByLabelText('Number of equal portions'),{target:{value:'3'}});
 fireEvent.change(screen.getByLabelText('Approved financial policy version'),{target:{value:'2'}});
 fireEvent.click(screen.getByRole('button',{name:'Reserve payer portions'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/visits/visit/payers','POST',{expectedVersion:4,equalCount:3,financialPolicyVersion:2}));
 expect((await screen.findByRole('link',{name:/Open payer portion/})).getAttribute('href')).toContain('/venue-pay/portion?token=scoped');
});
it('recovers reserved portions and permits direct drawer cash or unstarted release',async()=>{
 api.mockImplementation(async(_token:string,path:string,method:string)=>method==='GET'?{version:5,portions:[{id:'portion',token:'scoped',amountMinor:100000,currency:'NGN',state:'reserved',expiresAt:new Date(Date.now()+60000).toISOString()}]}:path.endsWith('/cash')?{changeMinor:20000}:{state:'expired'});
 render(<PayerControls token="owner" bill={{sessionId:'visit',locationId:'location',version:5,lineVersion:1,state:'unpaid',lines:[],moneyEnabled:true,financialPolicyVersion:1,supportedTenders:['cash','paystack'],totalMinor:100000,outstandingMinor:100000}} onRefresh={()=>{}}/>);
 await screen.findByRole('button',{name:'Release unstarted portion 1'});
 fireEvent.change(screen.getByLabelText('Cash tendered for portion 1 in kobo'),{target:{value:'120000'}});
 fireEvent.click(screen.getByRole('button',{name:'Collect cash for portion 1'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/visits/visit/payers/portion/cash','POST',{expectedVersion:5,amountTenderedMinor:120000}));
 expect(await screen.findByText(/Change due:.*200/)).toBeTruthy();
 fireEvent.click(screen.getByRole('button',{name:'Release unstarted portion 1'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/visits/visit/payers/portion/release','POST',{}));
});
it('never offers cash on platform-sourced service',async()=>{
 api.mockResolvedValue({version:5,portions:[{id:'portion',token:'scoped',amountMinor:100000,currency:'NGN',state:'pending',expiresAt:new Date(Date.now()+60000).toISOString()}]});
 render(<PayerControls token="owner" bill={{sessionId:'visit',locationId:'location',version:5,lineVersion:1,state:'unpaid',lines:[],moneyEnabled:true,financialPolicyVersion:1,supportedTenders:['paystack'],totalMinor:100000,outstandingMinor:100000}} onRefresh={()=>{}}/>);
 await screen.findByText(/pending/);
 expect(screen.queryByRole('button',{name:/Collect cash/})).toBeNull();
 expect(screen.queryByRole('button',{name:/Release unstarted/})).toBeNull();
});
