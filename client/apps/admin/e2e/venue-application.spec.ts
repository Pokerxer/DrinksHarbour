import {test,expect} from '@playwright/test';

test.beforeEach(async({context})=>{await context.route('**/*',route=>{const host=new URL(route.request().url()).hostname;return ['127.0.0.1','localhost'].includes(host)||host.endsWith('.localhost')?route.continue():route.abort();});});
test('customer request and staff canonical arrival use actual Next routes and JWT APIs',async({page,context,request})=>{
 const state=await(await request.get('http://127.0.0.1:39130/__test/state')).json();
 await context.addInitScript(({token,user})=>{sessionStorage.setItem('dh_token',token);sessionStorage.setItem('dh_user',JSON.stringify(user));},{token:state.customerToken,user:state.customer});
 await page.goto('http://127.0.0.1:39131/venues');await page.getByRole('button',{name:'Yes, I am 18 or older'}).click();await page.getByRole('button',{name:'Reject non-essential'}).click();await page.getByRole('link',{name:'View Main lounge location and menu',exact:true}).click();await expect(page).toHaveURL(/\/locations\/main$/,{timeout:60000});await expect(page.getByRole('heading',{name:'Main lounge',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:/Bottle.*75cl/})).toBeVisible();
 if(await page.getByRole('button',{name:'Reject non-essential'}).isVisible())await page.getByRole('button',{name:'Reject non-essential'}).click();await page.getByRole('link',{name:'Request a table',exact:true}).click();await expect(page).toHaveURL(/\/reserve$/,{timeout:60000});
 const wall=new Date(Date.now()+86400000).toISOString().slice(0,10)+'T20:00';await page.getByLabel('Requested date and time').fill(wall);await page.getByLabel('Phone number').fill('+234123456789');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send table request',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Awaiting venue confirmation'})).toBeVisible({timeout:60000});await page.getByRole('link',{name:'View request status'}).click();await expect(page).toHaveURL(/\/my-account\/reservations\/VR-/,{timeout:60000});await expect(page.getByRole('heading',{name:'Reservation request'})).toBeVisible({timeout:60000});
 const foreignList=await request.get(`http://127.0.0.1:39130/api/venue-experience/me/requests?customerId=${state.customer._id}`,{headers:{Authorization:`Bearer ${state.strangerToken}`}});
 expect(foreignList.status()).toBe(200);expect((await foreignList.json()).data.items).toEqual([]);
 await context.addCookies([{name:'next-auth.session-token',value:state.adminCookie,url:'http://127.0.0.1:39132',httpOnly:true,sameSite:'Lax'}]);
 await page.goto('http://127.0.0.1:39132/venue');await expect(page.getByRole('heading',{name:'Lounge workspace'})).toBeVisible();
 await page.getByRole('button',{name:'Mark reviewed',exact:true}).click();const guestCard=page.getByRole('article').filter({has:page.getByRole('heading',{name:/Browser Guest/})});await expect(guestCard.getByText('Awaiting venue confirmation',{exact:true})).toBeVisible();await expect(guestCard.getByText('reviewed',{exact:true})).toBeVisible();
 await page.getByLabel('Seat Browser Guest').selectOption(state.args.tableIds[0]);await page.getByRole('button',{name:'Check in arrival'}).click();await expect(guestCard.getByText('Checked in',{exact:true})).toBeVisible();await expect(guestCard.getByText('reviewed',{exact:true})).toBeVisible();
 const summary=await(await request.get('http://127.0.0.1:39130/__test/summary')).json();expect(summary).toEqual({bookings:1,visits:1,orders:1});
 await request.post('http://127.0.0.1:39130/__test/subscription/canceled');
 try{
  await page.goto('http://127.0.0.1:39132/venue-completion');await expect(page.getByRole('heading',{name:'Complete existing visits'})).toBeVisible({timeout:60000});
  const billResponse=page.waitForResponse(response=>response.url().includes('/service-sessions/')&&response.url().endsWith('/bill')&&response.request().method()==='GET');
  await page.getByRole('button',{name:'Open existing bill'}).click();expect((await billResponse).status()).toBe(200);await expect(page.getByRole('heading',{name:'Visit bill'})).toBeVisible();
  await expect(page.getByRole('button',{name:/new booking|new visit/i})).toHaveCount(0);
 }finally{await request.post('http://127.0.0.1:39130/__test/subscription/active');}

});
test('signed-out return context and branded subdomain location isolation work through Next',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});
 await page.goto('http://127.0.0.1:39131/venues/application-lounge/locations/main/reserve?at=2026-12-01T20%3A00&party=4');
 await page.getByRole('button',{name:'Yes, I am 18 or older'}).click();
 const signIn=page.getByRole('link',{name:'Sign in to send your request'});await expect(signIn).toBeVisible();expect(await signIn.getAttribute('href')).toContain('redirect=%2Fvenues%2Fapplication-lounge');
 const response=await request.get('http://127.0.0.1:39131/venues/application-lounge/locations/main',{headers:{host:'application-lounge.localhost:39131'}});expect(response.status()).toBe(200);
 const home=await request.get('http://127.0.0.1:39131/',{headers:{host:'application-lounge.localhost:39131'}});expect(home.status()).toBe(200);expect(await home.text()).toContain('Choose a location');
 const unknown=await request.get('http://127.0.0.1:39131/',{headers:{host:'unknown-venue.localhost:39131'}});expect(unknown.status()).toBe(404);
 const foreign=await request.get('http://127.0.0.1:39131/venues/other-venue/locations/main',{headers:{host:'application-lounge.localhost:39131'}});expect(foreign.status()).toBe(404);
 const malformed=await request.post('http://127.0.0.1:39131/api/venue-channel',{data:null});expect(malformed.status()).toBe(400);
 const proofBody={slug:'application-lounge',locationSlug:'main',input:{test:'body-bound'}};
 const platformProof=await request.post('http://127.0.0.1:39131/api/venue-channel',{data:proofBody});expect((await platformProof.json()).channel).toBe('platform');
 const directProof=await request.post('http://127.0.0.1:39131/api/venue-channel',{data:proofBody,headers:{host:'application-lounge.localhost:39131'}});expect((await directProof.json()).channel).toBe('direct');
 const denied=await page.goto('http://127.0.0.1:39132/venue');expect(denied?.url()).toContain('/signin');
});

import {phase2Journey} from './venue-phase2-journey';
test('accepted capacity, verified deposit, arrival and payer reconnect settle one canonical bill',async({page,context,request})=>{test.setTimeout(300000);await phase2Journey({page,context,request});});

test('food portions issue ingredients once and show recorded profit through the real staff application',async({page,context,request})=>{
 const root='http://127.0.0.1:39130';const state=(await(await request.get(`${root}/__test/state`)).json()).catalogCosting;
 await context.addCookies([{name:'next-auth.session-token',value:state.adminCookie,domain:'127.0.0.1',path:'/'}]);
 await page.goto('http://127.0.0.1:39131/venues/browser-kitchen/locations/main/menu');await page.getByRole('button',{name:'Yes, I am 18 or older'}).click();await page.getByRole('button',{name:'Reject non-essential'}).click();await expect(page.getByRole('heading',{name:'Food & drinks menu',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:'Rice dishes'})).toBeVisible();await expect(page.getByLabel('Portion for Kitchen jollof rice')).toBeVisible();
 const headers={Authorization:`Bearer ${state.staffToken}`,'Idempotency-Key':'browser-food-visit'};
 const opened=await request.post(`${root}/api/venue-ops/service-sessions`,{headers,data:{locationId:state.args.locationId,tableIds:state.args.tableIds,expectedTableVersions:state.args.expectedTableVersions,posSessionId:state.args.posSessionId}});expect(opened.ok()).toBe(true);const visit=(await opened.json()).data;
 await page.goto('http://127.0.0.1:39132/venue');await page.getByRole('button',{name:'Open visit bill'}).click();await expect(page.getByRole('heading',{name:'Order a serving'})).toBeVisible();await page.getByLabel('Portions',{exact:true}).fill('2');await page.getByRole('button',{name:'Add serving to visit'}).click();await expect(page.getByText('Serving added. Send new items to preparation before billing.')).toBeVisible();
 await page.getByRole('button',{name:'Send new items to preparation'}).click();await expect(page.getByText('New items sent to preparation.')).toBeVisible();
 await page.getByLabel('Guest meets the legal drinking age').check();await page.getByRole('button',{name:'Review and freeze bill'}).click();await page.getByLabel('Cash received (₦)').fill('10000');await page.getByRole('button',{name:'Record cash payment'}).click();await expect(page.getByText(/Payment settled/)).toBeVisible();
 await page.goto('http://127.0.0.1:39132/venue?tool=profitability');await expect(page.getByRole('heading',{name:'Menu margin',exact:true})).toBeVisible();await page.getByLabel('From business date').fill(visit.businessDate);await page.getByLabel('To business date').fill(visit.businessDate);await expect(page.getByText('Regular plate',{exact:true})).toBeVisible();await expect(page.getByText('₦9,900.00',{exact:true})).toHaveCount(3);
 const summary=await(await request.get(`${root}/__test/catalog-costing/summary`)).json();expect(summary).toEqual({bills:1,receipts:1,consumptions:1,costs:1,rawQuantity:0,cogsMinor:10000});
 await page.reload();await expect(page.getByText('₦9,900.00',{exact:true})).toHaveCount(3);expect(await(await request.get(`${root}/__test/catalog-costing/summary`)).json()).toEqual(summary);
 await page.goto('http://127.0.0.1:39132/venue?tool=servings');await expect(page.getByRole('heading',{name:'Serving definitions'})).toBeVisible();await expect(page.getByRole('option',{name:'Regular plate · regular'})).toBeAttached();
});
