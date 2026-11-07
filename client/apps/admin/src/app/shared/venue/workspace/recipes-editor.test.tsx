// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import RecipesEditor from './recipes-editor';
const {getRecipes,saveRecipe}=vi.hoisted(()=>({getRecipes:vi.fn(),saveRecipe:vi.fn()}));
vi.mock('@/services/venue/recipes',()=>({getRecipes,saveRecipe}));
afterEach(()=>{cleanup();getRecipes.mockReset();saveRecipe.mockReset();});

const version=(over={})=>({id:'v1',subProductId:'spirit',sizeId:'bottle',version:1,components:[{profileId:'profile-1',quantity:50,unit:'ml'}],yieldAssumption:{units:10,lossMl:null},method:'shake hard',costMinorPerUnit:null,effectiveFrom:null,supersededBy:null,createdBy:'staff',createdAt:null,...over});
const group=(over={})=>({subProductId:'spirit',sizeId:'bottle',versions:[version(over)],activeVersion:version(over),...over});
const menu={sections:[{id:'s',name:'Bar',items:[{subProductId:'spirit',sizeId:'bottle',published:true}]}]};

it("lists a menu output's recipe with an 'unknown' projected cost and supersedes with a new version on save",async()=>{
  getRecipes.mockResolvedValue({items:[group({})]});
  saveRecipe.mockResolvedValue(version({version:2,method:'stir gently'}));
  render(<RecipesEditor token="owner" locationId="location" menu={menu}/>);
  await screen.findByText(/Projected cost per serving: unknown/);
  expect(screen.getByText(/cost unknown · active/)).toBeTruthy(); // history reads null costs as unknown too
  fireEvent.change(screen.getByLabelText('Method'),{target:{value:'stir gently'}});
  fireEvent.click(screen.getByRole('button',{name:'Supersede with new version'}));
  await waitFor(()=>expect(saveRecipe).toHaveBeenCalledWith('owner','location','spirit',{sizeId:'bottle',expectedVersion:1,input:expect.objectContaining({method:'stir gently'})}));
  await screen.findByText(/Superseded with new version 2\./);
  expect(getRecipes).toHaveBeenCalledWith('owner','location'); // list reloaded after the supersede
});

it('shows a known projected cost in naira and filters outputs that are not on the menu',async()=>{
  getRecipes.mockResolvedValue({items:[group({costMinorPerUnit:120000}),{subProductId:'off-menu',sizeId:'size-2',versions:[],activeVersion:null}]});
  render(<RecipesEditor token="owner" locationId="location" menu={menu}/>);
  await screen.findByText(/Projected cost per serving: ₦1,200.00/);
  expect(screen.queryByText(/off-menu/)).toBeNull();
});

it('keeps saving disabled while a component row has no profile chosen',async()=>{
  getRecipes.mockResolvedValue({items:[group({})]});
  render(<RecipesEditor token="owner" locationId="location" menu={menu}/>);
  await screen.findByText(/Projected cost per serving: unknown/);
  expect(screen.getByRole('button',{name:'Supersede with new version'}).hasAttribute('disabled')).toBe(false);
  fireEvent.click(screen.getByRole('button',{name:'Add component row'}));
  expect(screen.getByRole('button',{name:'Supersede with new version'}).hasAttribute('disabled')).toBe(true);
});
const ingredientMocks=vi.hoisted(()=>({getIngredientProfiles:vi.fn(),getIngredientCandidates:vi.fn(),createIngredientProfile:vi.fn()}));vi.mock('@/services/venue/ingredients',()=>ingredientMocks);
it('authors a first recipe for a new portion using an owned mass profile and exact stock mapping',async()=>{
 getRecipes.mockResolvedValue({items:[group({versions:[],activeVersion:null,isVenueServing:true})]});ingredientMocks.getIngredientProfiles.mockResolvedValue({items:[{id:'rice-profile',subProductId:'rice-stock',name:'Rice stock',dimension:'mass',gramsPerMl:null,perishable:false,allergenSource:[],stockForms:[{id:'bag',name:'100g bag'}]}]});ingredientMocks.getIngredientCandidates.mockResolvedValue({items:[]});
 render(<RecipesEditor token="owner" locationId="location" menu={{schemaVersion:2,sections:[],categories:[]}}/>);await screen.findByRole('combobox',{name:/^Menu output/});fireEvent.click(screen.getByRole('button',{name:'Add component row'}));fireEvent.change(screen.getByLabelText('Component 1 profile'),{target:{value:'rice-profile'}});expect((screen.getByLabelText('Unit') as HTMLSelectElement).value).toBe('g');fireEvent.change(screen.getByLabelText('Ingredient stock form'),{target:{value:'bag'}});fireEvent.change(screen.getByLabelText('Content per stock unit (g)'),{target:{value:'100'}});fireEvent.change(screen.getByLabelText('Quantity'),{target:{value:'50'}});fireEvent.click(screen.getByRole('button',{name:'Supersede with new version'}));await waitFor(()=>expect(saveRecipe).toHaveBeenCalledWith('owner','location','spirit',expect.objectContaining({expectedVersion:0,input:expect.objectContaining({components:[expect.objectContaining({profile:'rice-profile',unit:'g',stockMapping:expect.objectContaining({sourceSizeId:'bag',contentQuantity:{amountScaled:10000,scale:100,unit:'g'}})})]})})));
});

it('preserves reviewed yield loss when changing only the recipe method', async () => {
  getRecipes.mockResolvedValue({items:[group({yieldAssumption:{units:10,lossMl:25}})]});
  saveRecipe.mockResolvedValue(version({version:2}));
  render(<RecipesEditor token="owner" locationId="location" menu={menu}/>);
  await screen.findByLabelText('Method');
  fireEvent.change(screen.getByLabelText('Method'),{target:{value:'stir gently'}});
  fireEvent.click(screen.getByRole('button',{name:'Supersede with new version'}));
  await waitFor(()=>expect(saveRecipe).toHaveBeenCalledWith('owner','location','spirit',expect.objectContaining({input:expect.objectContaining({yieldAssumption:{units:10,lossMl:25}})})));
});

it('reloads the selected recipe draft together with its version before further saves',async()=>{
 getRecipes.mockResolvedValueOnce({items:[group({})]}).mockResolvedValue({items:[group({id:'v2',version:2,method:'New reviewed method',components:[{profileId:'profile-1',quantity:75,unit:'ml'}]})]});
 render(<RecipesEditor token="owner" locationId="location" menu={menu}/>);
 await screen.findByLabelText('Method');
 fireEvent.click(screen.getByRole('button',{name:'Reload recipes'}));
 await waitFor(()=>expect((screen.getByLabelText('Method') as HTMLTextAreaElement).value).toBe('New reviewed method'));
 expect((screen.getByLabelText('Quantity') as HTMLInputElement).value).toBe('75');
});
