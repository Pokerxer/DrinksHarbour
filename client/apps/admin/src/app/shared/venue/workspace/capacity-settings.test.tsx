// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import CapacitySettings from './capacity-settings';
const {api}=vi.hoisted(()=>({api:vi.fn()}));vi.mock('@/services/venue/experience',()=>({experienceRequest:api}));
afterEach(()=>{cleanup();api.mockReset();});
it('reviews dated local service windows and saves a versioned physical table policy',async()=>{
 api.mockResolvedValueOnce(null).mockResolvedValueOnce({version:1});
 render(<CapacitySettings token="owner" locationId="location" timezone="Africa/Lagos" tables={[{_id:'table',name:'Table 1',seats:4,status:'available',venueVersion:0}]}/>);
 await screen.findByText('Choose tables and dated service windows before enabling capacity.');
 fireEvent.click(screen.getByLabelText('Table 1 · 4 seats'));
 fireEvent.change(screen.getByLabelText('Service starts'),{target:{value:'2026-12-01T18:00'}});
 fireEvent.change(screen.getByLabelText('Service ends'),{target:{value:'2026-12-02T02:00'}});
 fireEvent.click(screen.getByLabelText('Enable capacity acceptance'));
 fireEvent.click(screen.getByRole('button',{name:'Save capacity policy'}));
 await waitFor(()=>expect(api).toHaveBeenCalledWith('owner','/locations/location/capacity','PUT',expect.objectContaining({expectedVersion:0,input:expect.objectContaining({resources:['table'],windows:[{start:'2026-12-01T17:00:00.000Z',end:'2026-12-02T01:00:00.000Z'}]})})));
});
