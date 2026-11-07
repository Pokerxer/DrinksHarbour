// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';import {afterEach,expect,it,vi} from 'vitest';import ProductionPanel from './production-panel';
const {listProduction,productionCommand,getRecipes}=vi.hoisted(()=>({listProduction:vi.fn(),productionCommand:vi.fn(),getRecipes:vi.fn()}));
vi.mock('@/services/venue/costing',()=>({listProduction,productionCommand,createProduction:vi.fn()}));vi.mock('@/services/venue/recipes',()=>({getRecipes}));afterEach(()=>{cleanup();vi.clearAllMocks();});
it('reserves a draft with its version and preserves the batch after a shortage',async()=>{listProduction.mockResolvedValue({items:[{id:'batch-1',version:2,state:'draft'}]});getRecipes.mockResolvedValue({items:[]});productionCommand.mockRejectedValue(new Error('Insufficient ingredient stock'));render(<ProductionPanel token="owner" locationId="location"/>);fireEvent.click(await screen.findByRole('button',{name:'Reserve ingredients'}));await screen.findByRole('alert');expect(screen.getByText('Draft')).toBeTruthy();expect(productionCommand).toHaveBeenCalledWith('owner','location',expect.objectContaining({id:'batch-1',version:2}),'reserve',undefined);expect(productionCommand).toHaveBeenCalledTimes(1);});

it('does not complete measured output with fractional whole portions', async () => {
  listProduction.mockResolvedValue({items:[{id:'batch-1',version:2,state:'reserved'}]});
  getRecipes.mockResolvedValue({items:[]});
  render(<ProductionPanel token="owner" locationId="location"/>);
  const complete=await screen.findByRole('button',{name:'Complete measured output'});
  fireEvent.change(screen.getByLabelText('Production or cancellation note'),{target:{value:'Measured after preparation'}});
  fireEvent.change(screen.getByLabelText('Measured usable portions'),{target:{value:'1.5'}});
  expect(complete.hasAttribute('disabled')).toBe(true);
  fireEvent.click(complete);
  expect(productionCommand).not.toHaveBeenCalled();
});
