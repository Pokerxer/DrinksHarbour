// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';import {afterEach,expect,it,vi} from 'vitest';
import ProfitabilityPanel from './profitability-panel';import ServingEditor from './serving-editor';
const {getMarginReport,getCostingReadiness,listServings,saveServing}=vi.hoisted(()=>({getMarginReport:vi.fn(),getCostingReadiness:vi.fn(),listServings:vi.fn(),saveServing:vi.fn()}));
vi.mock('@/services/venue/costing',()=>({getMarginReport,getCostingReadiness,listServings,saveServing}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
it('shows unknown actual cost and retries reads without resubmitting commands',async()=>{
 getMarginReport.mockRejectedValueOnce(new Error('Connection interrupted')).mockResolvedValue({rows:[{sourceId:'line',lineId:'meal',servingSnapshot:{displayName:'Regular plate'},netMerchandiseMinor:500000,recordedCogsMinor:null,grossProfitMinor:null,grossMarginPct:null,markupPct:null,contributionMinor:null,costStatus:'unknown',missingReasons:['cost_recognition_missing']}],totals:{netMerchandiseMinor:500000,grossProfitMinor:null,contributionMinor:null},coverage:{costPct:0},nextCursor:null,asOf:'2026-10-30T12:00:00Z',basis:'recorded'});
 render(<ProfitabilityPanel token="owner" locationId="location"/>);await screen.findByRole('alert');fireEvent.click(screen.getByRole('button',{name:'Retry report'}));await screen.findByText('Regular plate');expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0);expect(screen.queryByText('₦0.00')).toBeNull();expect(getMarginReport).toHaveBeenCalledTimes(2);
});
it('keeps serving authoring inactive until rollout is reviewed',async()=>{
 getCostingReadiness.mockResolvedValue({servingsEnabled:false,actualCostingEnabled:false,policyStatus:'not_configured',grants:[]});listServings.mockResolvedValue({items:[]});
 render(<ServingEditor token="owner" locationId="location" catalog={[]}/>);await screen.findByText(/Serving authoring is inactive/);expect(screen.getByRole('button',{name:'Save serving'}).hasAttribute('disabled')).toBe(true);expect(saveServing).not.toHaveBeenCalled();
});
it('shows recorded and estimated basis labels without claiming business net profit',async()=>{
 getMarginReport.mockResolvedValue({rows:[],totals:{netMerchandiseMinor:0,grossProfitMinor:0,contributionMinor:null},coverage:{costPct:100},nextCursor:null,asOf:'2026-10-30T12:00:00Z',basis:'recorded'});
 render(<ProfitabilityPanel token="owner" locationId="location"/>);await screen.findByText('No recognised merchandise in this interval. Choose another business-date range.');expect(screen.getByLabelText('Report basis')).toBeTruthy();expect(screen.getByText(/posted accounting reports/)).toBeTruthy();
});
it('keeps the serving draft after a version conflict instead of silently resubmitting',async()=>{
 getCostingReadiness.mockResolvedValue({servingsEnabled:true,actualCostingEnabled:false,policyStatus:'draft',grants:['venue:servings_write']});listServings.mockResolvedValue({items:[]});saveServing.mockRejectedValue(new Error('Serving changed; refresh'));
 render(<ServingEditor token="owner" locationId="location" catalog={[{id:'meal',name:'Rice',sizes:[]}]}/>);await screen.findByRole('button',{name:'Save serving'});await screen.findByText('Serving definitions');await waitFor(()=>expect(screen.getByRole('button',{name:'Save serving'}).hasAttribute('disabled')).toBe(false));fireEvent.change(screen.getByLabelText('Item'),{target:{value:'meal'}});fireEvent.change(screen.getByLabelText('Serving name'),{target:{value:'Large plate'}});fireEvent.change(screen.getByLabelText('Stable serving code'),{target:{value:'large'}});fireEvent.change(screen.getByLabelText('Selling price (₦)'),{target:{value:'5000'}});fireEvent.click(screen.getByRole('button',{name:'Save serving'}));await screen.findByRole('alert');expect((screen.getByLabelText('Serving name') as HTMLInputElement).value).toBe('Large plate');expect(saveServing).toHaveBeenCalledTimes(1);
});

it('blocks another create and offers a read retry when saving succeeded but the list refresh failed',async()=>{
 getCostingReadiness.mockResolvedValue({servingsEnabled:true,grants:['venue:servings_write']});
 listServings.mockResolvedValueOnce({items:[]}).mockRejectedValueOnce(new Error('List connection lost')).mockResolvedValue({items:[{id:'new-size',subProductId:'meal',code:'regular',displayName:'Regular plate',mode:'made_to_order',saleUnit:'plate',sellingPrice:5000,version:1}]});
 saveServing.mockResolvedValue({id:'new-size',version:1});
 render(<ServingEditor token="owner" locationId="location" catalog={[{id:'meal',name:'Rice',sizes:[]}]}/>);
 const save=screen.getByRole('button',{name:'Save serving'});
 await waitFor(()=>expect(save.hasAttribute('disabled')).toBe(false));
 fireEvent.change(screen.getByLabelText('Item'),{target:{value:'meal'}});
 fireEvent.change(screen.getByLabelText('Serving name'),{target:{value:'Regular plate'}});
 fireEvent.change(screen.getByLabelText('Stable serving code'),{target:{value:'regular'}});
 fireEvent.change(screen.getByLabelText('Selling price (₦)'),{target:{value:'5000'}});
 fireEvent.click(save);
 await screen.findByRole('alert');
 expect(save.hasAttribute('disabled')).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Reload servings'}));
 await waitFor(()=>expect(save.hasAttribute('disabled')).toBe(false));
 expect((screen.getByLabelText('Existing serving') as HTMLSelectElement).value).toBe('new-size');
 expect(saveServing).toHaveBeenCalledTimes(1);
});

it('preserves a reviewed servings-per-unit conversion when editing a serving name',async()=>{
 getCostingReadiness.mockResolvedValue({servingsEnabled:true,grants:['venue:servings_write']});
 listServings.mockResolvedValue({items:[{id:'size',subProductId:'meal',code:'tray',displayName:'Tray',mode:'prepared_batch',saleUnit:'tray',sellingPrice:5000,servingsPerUnit:12,version:1}]});
 saveServing.mockResolvedValue({id:'size',version:2});
 render(<ServingEditor token="owner" locationId="location" catalog={[{id:'meal',name:'Rice',sizes:[]}]}/>);
 await screen.findByRole('option',{name:'Tray · tray'});
 fireEvent.change(screen.getByLabelText('Existing serving'),{target:{value:'size'}});
 fireEvent.change(screen.getByLabelText('Serving name'),{target:{value:'Family tray'}});
 fireEvent.click(screen.getByRole('button',{name:'Save serving'}));
 await waitFor(()=>expect(saveServing).toHaveBeenCalledWith('owner','location',expect.objectContaining({input:expect.objectContaining({servingsPerUnit:12})}),'size'));
});
