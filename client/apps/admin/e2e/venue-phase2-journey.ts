import {expect,type Page,type BrowserContext,type APIRequestContext} from '@playwright/test';
export async function phase2Journey({page,context,request}:{page:Page;context:BrowserContext;request:APIRequestContext}){
 const root='http://127.0.0.1:39130';const state=(await(await request.get(`${root}/__test/state`)).json()).phase2;
 const customerHeaders={Authorization:`Bearer ${state.customerToken}`};
 const headers={Authorization:`Bearer ${state.staffToken}`,'Idempotency-Key':'browser-lines'};
 await context.addInitScript(({token,user})=>{sessionStorage.setItem('dh_token',token);sessionStorage.setItem('dh_user',JSON.stringify(user));},{token:state.customerToken,user:state.customer});
 // Fulfilled locally: this is provider handoff/reconnect proof, not hosted certification.
 await context.route('https://checkout.paystack.com/**',route=>route.fulfill({contentType:'text/html',body:'<h1>Local synthetic provider handoff</h1>'}));
 await page.goto(`http://127.0.0.1:39131/venues/capacity-lounge/locations/capacity/reserve?at=${encodeURIComponent(state.wall)}&party=2`);
 await page.getByRole('button',{name:'Yes, I am 18 or older'}).click();
 if(await page.getByRole('button',{name:'Reject non-essential'}).isVisible())await page.getByRole('button',{name:'Reject non-essential'}).click();
 await page.getByRole('button',{name:'Check current availability'}).click();await expect(page.getByText(/Capacity is available now/)).toBeVisible();
 await page.getByLabel('Phone number').fill('+234123456789');await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Send table request',exact:true}).click();await page.getByRole('link',{name:'View request status'}).click();
 await expect(page).toHaveURL(/\/my-account\/reservations\/VR-/,{timeout:60000});await expect(page.getByRole('heading',{name:'Reservation request'})).toBeVisible();
 const reservationURL=page.url(),reference=reservationURL.split('/').pop()!;
 await expect(page.getByRole('button',{name:'Pay deposit with Paystack'})).toHaveCount(0);
 await context.addCookies([{name:'next-auth.session-token',value:state.adminCookie,url:'http://127.0.0.1:39132',httpOnly:true,sameSite:'Lax'}]);
 await page.goto('http://127.0.0.1:39132/venue');await page.getByRole('button',{name:'Check booking availability'}).click();await page.getByLabel('Available tables').selectOption('0');await page.getByRole('button',{name:'Accept booking',exact:true}).click();await expect(page.getByText(/held/, {exact:false}).first()).toBeVisible();
 await page.goto(reservationURL);await expect(page.getByText('Booking financial terms')).toBeVisible();await page.getByRole('checkbox').check();
 const startedResponse=page.waitForResponse(r=>r.url().endsWith('/deposit')&&r.request().method()==='POST');
 await page.getByRole('button',{name:'Pay deposit with Paystack'}).click();expect((await startedResponse).ok()).toBe(true);
 await expect(page.getByRole('heading',{name:'Local synthetic provider handoff'})).toBeVisible();
 const started=(await(await request.get(`${root}/api/venue-experience/me/requests/${reference}/deposit`,{headers:customerHeaders})).json()).data;
 await page.goto(reservationURL);await expect(page.getByRole('button',{name:'Check deposit payment'})).toBeVisible();await expect(page.getByRole('button',{name:'Pay deposit with Paystack'})).toHaveCount(0);
 expect((await request.post(`${root}/__test/phase2/provider-paid/${started.attemptId}`)).ok()).toBe(true);
 await page.getByRole('button',{name:'Check deposit payment'}).click();await expect(page.getByText(/Deposit received. Refresh/)).toBeVisible();
 await page.goto('http://127.0.0.1:39132/venue');await page.getByLabel('Seat Capacity Guest').selectOption(state.args.tableIds[0]);await page.getByRole('button',{name:'Check in arrival'}).click();const arrival=page.getByRole('article').filter({has:page.getByRole('heading',{name:/Capacity Guest/})});await expect(arrival.getByText('Checked in',{exact:true})).toBeVisible();await expect(arrival.getByText('reviewed',{exact:true})).toBeVisible();
 const owned=(await(await request.get(`${root}/api/venue-experience/me/requests/${reference}`,{headers:{Authorization:`Bearer ${state.customerToken}`}})).json()).data;
 const open=(await(await request.get(`${root}/api/venue-ops/service-sessions/${owned.serviceSessionId}/bill`,{headers})).json()).data;
 const prepared=await request.put(`${root}/api/venue-ops/service-sessions/${owned.serviceSessionId}/lines`,{headers,data:{expectedVersion:open.version,lines:[state.line]}});expect(prepared.ok()).toBe(true);
 await page.getByRole('button',{name:'Open visit bill'}).click();await page.getByLabel('Guest meets the legal drinking age').check();await page.getByRole('button',{name:'Review and freeze bill'}).click();await expect(page.getByText(/Applied payments and credit/)).toBeVisible();
 await page.getByLabel('Number of equal portions').fill('2');await page.getByRole('button',{name:'Reserve payer portions'}).click();
 const links=page.getByRole('link',{name:/Open payer portion/});await expect(links).toHaveCount(2);const urls=await links.evaluateAll(nodes=>nodes.map(n=>(n as HTMLAnchorElement).href));
 for(const payerURL of urls){
  await page.goto(payerURL);await expect(page.getByRole('heading',{name:'Pay your portion'})).toBeVisible();
  const paymentResponse=page.waitForResponse(r=>r.url().endsWith('/collect')&&r.request().method()==='POST');await page.getByRole('button',{name:/Pay with Paystack/}).click();expect((await paymentResponse).ok()).toBe(true);await expect(page.getByRole('heading',{name:'Local synthetic provider handoff'})).toBeVisible();const entry=new URL(payerURL);const payment=(await(await request.get(`${root}/api/venue-experience/payers/${entry.pathname.split('/').pop()}${entry.search}`,{headers:customerHeaders})).json()).data.payment;
  await page.goto(payerURL);await expect(page.getByRole('button',{name:'Check payment',exact:true})).toBeVisible();expect((await request.post(`${root}/__test/phase2/provider-paid/${payment.attemptId}`)).ok()).toBe(true);await page.getByRole('button',{name:'Check payment',exact:true}).click();await expect(page.getByText('Your payment has been applied to the bill.')).toBeVisible();
  await page.reload();await expect(page.getByText('Your payment has been applied to the bill.')).toBeVisible();
 }
 const summary=await(await request.get(`${root}/__test/phase2/summary`)).json();expect(summary).toEqual({receipts:3,visits:1,bills:1,movements:1,attempts:3});
 const final=(await(await request.get(`${root}/api/venue-ops/service-sessions/${owned.serviceSessionId}/bill`,{headers})).json()).data;expect(final.state).toBe('settled');expect(final.outstandingMinor).toBe(0);expect(final.totalMinor).toBe(300000);expect(final.allocatedMinor).toBe(300000);
}
