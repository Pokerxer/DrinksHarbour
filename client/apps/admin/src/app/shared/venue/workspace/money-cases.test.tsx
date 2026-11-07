// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import MoneyCases from './money-cases';
const {api}=vi.hoisted(()=>({api:vi.fn()}));vi.mock('@/services/venue/experience',()=>({experienceRequest:api}));
afterEach(()=>{cleanup();api.mockReset();});
it('keeps pending refunds visible and does not claim they are refunded or invite resubmission',async()=>{
 api.mockResolvedValue({items:[{receiptId:'receipt',amountMinor:100000,currency:'NGN',appliedMinor:0,unappliedMinor:100000,refundedMinor:0,resolution:'paid_needs_resolution',refunds:[{id:'case',state:'pending',version:2,amountMinor:50000,currency:'NGN',reason:'Review',providerFeeResolution:'review_required'}]}],next:null,providerExecutionEnabled:false});
 render(<MoneyCases token="owner" locationId="location"/>);
 await screen.findByText(/pending · ₦500.00/);
 expect(screen.queryByRole('button',{name:'Submit approved refund'})).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Check provider refund'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/refunds/case/reconcile','POST',{}));
 expect(screen.getByText(/Provider initiation is not completed refund evidence/)).toBeTruthy();
});
it('links evidence for an uncertain submission without offering another refund initiation',async()=>{
 api.mockResolvedValue({items:[{receiptId:'receipt',amountMinor:100000,currency:'NGN',appliedMinor:0,unappliedMinor:100000,refundedMinor:0,resolution:'paid_needs_resolution',refunds:[{id:'case',state:'needs_review',version:3,amountMinor:50000,currency:'NGN',reason:'Submission outcome unknown',providerFeeResolution:'review_required'}]}],next:null,providerExecutionEnabled:true});
 render(<MoneyCases token="owner" locationId="location"/>);await screen.findByText(/needs_review · ₦500.00/);
 expect(screen.queryByRole('button',{name:'Submit approved refund'})).toBeNull();
 fireEvent.change(screen.getByLabelText('Review reason'),{target:{value:'Matched original reference'}});
 fireEvent.change(screen.getByLabelText('Evidence references (one per line)'),{target:{value:'provider-review'}});
 fireEvent.change(screen.getByLabelText('Provider refund ID'),{target:{value:'refund-123'}});
 fireEvent.click(screen.getByRole('button',{name:'Link verified provider evidence'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/refunds/case/link-evidence','POST',{expectedVersion:3,providerRefundId:'refund-123',reason:'Matched original reference',evidence:['provider-review']}));
});
