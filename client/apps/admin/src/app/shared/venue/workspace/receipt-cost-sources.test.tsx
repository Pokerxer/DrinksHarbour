// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';import {afterEach,expect,it,vi} from 'vitest';import ReceiptCostSources from './receipt-cost-sources';
const {getReceiptSources,linkReceiptValue}=vi.hoisted(()=>({getReceiptSources:vi.fn(),linkReceiptValue:vi.fn()}));vi.mock('@/services/venue/receipt-valuation',()=>({getReceiptSources,linkReceiptValue}));afterEach(()=>{cleanup();vi.clearAllMocks();});
it('submits original lot and receipt references without supplying the receipt cost',async()=>{getReceiptSources.mockResolvedValue({lots:[{id:'lot',subProductId:'bottle',sizeId:'size',batchNumber:'LOT-A',quantity:3,initialQuantity:3,linked:false}],receipts:[{id:'receipt',subProductId:'bottle',sizeId:'size',batchNumber:'LOT-A',quantity:3,amountMinor:100,performedAt:'2026-10-30T12:00:00Z'}]});linkReceiptValue.mockResolvedValue({id:'lot',version:1,status:'source_linked'});render(<ReceiptCostSources token="owner" locationId="location"/>);fireEvent.change(await screen.findByLabelText('Untouched lot'),{target:{value:'lot'}});fireEvent.change(screen.getByLabelText('Original received stock record'),{target:{value:'receipt'}});fireEvent.change(screen.getByLabelText('Review reason'),{target:{value:'Original supplier receipt and lot reviewed'}});fireEvent.click(screen.getByRole('button',{name:'Link reviewed receipt'}));await waitFor(()=>expect(linkReceiptValue).toHaveBeenCalledWith('owner','location','lot',{receiptId:'receipt',contentQuantity:{amountScaled:1,scale:1,unit:'count'},reason:'Original supplier receipt and lot reviewed'}));});

it('keeps a successful receipt link acknowledged when refreshing sources fails',async()=>{
 getReceiptSources.mockResolvedValueOnce({lots:[{id:'lot',subProductId:'bottle',sizeId:'size',batchNumber:'LOT-A',quantity:3,initialQuantity:3,linked:false}],receipts:[{id:'receipt',subProductId:'bottle',sizeId:'size',batchNumber:'LOT-A',quantity:3,amountMinor:100,performedAt:'2026-10-30T12:00:00Z'}]}).mockRejectedValueOnce(new Error('Refresh interrupted')).mockResolvedValue({lots:[],receipts:[]});
 linkReceiptValue.mockResolvedValue({id:'lot',version:1,status:'source_linked'});
 render(<ReceiptCostSources token="owner" locationId="location"/>);
 await waitFor(()=>expect(screen.getByRole('option',{name:/LOT-A · 3 stock units/})).toBeTruthy());
 fireEvent.change(screen.getByLabelText('Untouched lot'),{target:{value:'lot'}});
 fireEvent.change(screen.getByLabelText('Original received stock record'),{target:{value:'receipt'}});
 fireEvent.change(screen.getByLabelText('Review reason'),{target:{value:'Original supplier receipt reviewed'}});
 fireEvent.click(screen.getByRole('button',{name:'Link reviewed receipt'}));
 await screen.findByRole('alert');
 expect(screen.getByText(/Original receipt linked/)).toBeTruthy();
 expect(screen.getByRole('button',{name:'Link reviewed receipt'}).hasAttribute('disabled')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Reload receipts'}));
 await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 expect(linkReceiptValue).toHaveBeenCalledTimes(1);
});
