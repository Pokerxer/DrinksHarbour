"""Actual Next/JWT/Mongo recovery journey, synthetic records and local-only traffic."""
import json
import re
import urllib.request
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, expect
API='http://127.0.0.1:39140'
ADMIN='http://127.0.0.1:39142'
SHOP='http://127.0.0.1:39143'
def read(path):
 with urllib.request.urlopen(API+path,timeout=30) as response:return json.load(response)
def warm(url,cookie=None):
 request=urllib.request.Request(url,headers={'Cookie':'next-auth.session-token='+cookie} if cookie else {})
 with urllib.request.urlopen(request,timeout=180) as response:assert response.status==200
state=read('/__test/state')
warm(ADMIN+'/merchant-orders',state['cookie'])
warm(SHOP+'/my-account/orders/'+state['orderId'])
with sync_playwright() as p:
 browser=p.chromium.launch(channel='chrome',headless=True)
 def local(route):
  route.continue_() if route.request.url.startswith((API+'/',ADMIN+'/',SHOP+'/')) else route.abort()
 context=browser.new_context();context.route('**/*',local)
 context.add_cookies([{'name':'next-auth.session-token','value':state['cookie'],'url':ADMIN,'httpOnly':True,'sameSite':'Lax'}])
 page=context.new_page();errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 try:
  page.goto(ADMIN+'/merchant-orders');page.wait_for_load_state('networkidle')
  expect(page.get_by_role('heading',name='Merchant fulfillment',exact=True)).to_be_visible()
  page.get_by_role('button',name='Review merchandise refunds',exact=True).click()
  financial=page.get_by_role('region',name='Financial readiness',exact=True)
  expect(financial.get_by_text('Refund execution is disabled.',exact=True)).to_be_visible()
  page.get_by_role('button',name='External parcel delivery',exact=True).click()
  expect(page.get_by_text('New carrier booking is disabled. Existing responsibilities remain available.',exact=True)).to_be_visible()
  page.get_by_role('button',name='Local rider delivery',exact=True).click()
  expect(page.get_by_text('New local bookings are disabled.',exact=False)).to_be_visible()
  expect(page.get_by_text('No current reviewed local delivery terms for this location.',exact=False)).to_be_visible()
  page.get_by_role('textbox',name='Recovery reason',exact=True).fill('Synthetic recipient now confirmed available')
  page.get_by_role('combobox',name='Retry rider',exact=True).select_option(state['driver'])
  with page.expect_response(lambda r:r.url.endswith('/recover') and r.request.method=='POST') as retry:
   page.get_by_role('button',name='Reattempt original delivery',exact=True).click()
  assert retry.value.status==200,retry.value.text()
  page.get_by_role('textbox',name='Failed drop reason',exact=True).fill('Synthetic recipient unavailable again')
  with page.expect_response(lambda r:r.url.endswith('/resolve') and r.request.method=='POST') as failed:
   page.get_by_role('button',name='Record failed drop',exact=True).click()
  assert failed.value.status==200,failed.value.text()
  page.get_by_role('textbox',name='Recovery reason',exact=True).fill('Synthetic return original goods to origin')
  with page.expect_response(lambda r:r.url.endswith('/recover') and r.request.method=='POST') as requested:
   page.get_by_role('button',name='Request goods return',exact=True).click()
  assert requested.value.status==200,requested.value.text()
  expect(page.get_by_text('Return requested; no stock or money is restored.',exact=False)).to_be_visible()
  page.get_by_role('textbox',name='Recovery reason',exact=True).fill('Synthetic original goods physically received')
  with page.expect_response(lambda r:r.url.endswith('/recover') and r.request.method=='POST') as received:
   page.get_by_role('button',name='Confirm receipt into quarantine',exact=True).click()
  assert received.value.status==200,received.value.text()
  expect(page.get_by_text('Goods physically received into quarantine.',exact=False)).to_be_visible()
  summary=read('/__test/summary')
  assert summary['stock']==9 and summary['reserved']==4,summary
  assert summary['allocations']==1 and summary['trips']==2 and summary['receipts']==1,summary
  assert summary['budgetUnchanged'] and not summary['creationEnabled'] and summary['contractState']=='revoked',summary
  assert sum(v['shipped'] for v in summary['progress'])==1 and sum(v['delivered'] for v in summary['progress'])==0,summary
  setup=urllib.request.Request(API+'/__test/prepare-carrier',data=b'{}',headers={'Content-Type':'application/json'},method='POST')
  with urllib.request.urlopen(setup,timeout=30) as response:carrier=json.load(response)
  page.get_by_role('button',name='Refresh carrier responsibilities',exact=True).click()
  page.get_by_label('Carrier shipment',exact=True).select_option(carrier['allocation'])
  for label in ['Package length (cm)','Package width (cm)','Package height (cm)']:page.get_by_label(label,exact=True).fill('10')
  page.get_by_label('Carrier pickup date',exact=True).fill((datetime.now()+timedelta(days=1)).strftime('%Y-%m-%d'))
  with page.expect_response(lambda r:r.url.endswith('/quotes') and '/merchant-carrier/' in r.url) as quote:
   page.get_by_role('button',name='Get reviewed carrier rates',exact=True).click()
  assert quote.value.status==201,quote.value.text()
  page.get_by_role('button',name='Choose Synthetic parcel',exact=True).click()
  expect(page.get_by_role('region',name='Confirm carrier charge',exact=True)).to_be_visible()
  with page.expect_response(lambda r:r.url.endswith('/bookings') and '/merchant-carrier/' in r.url) as carrier_booked:
   page.get_by_role('button',name='Confirm carrier booking',exact=True).click()
  assert carrier_booked.value.status==200,carrier_booked.value.text()
  with page.expect_response(lambda r:r.url.endswith('/refresh') and '/merchant-carrier/' in r.url) as observed:
   page.get_by_role('button',name='Refresh provider observation',exact=True).click()
  assert observed.value.status==200,observed.value.text()
  expect(page.get_by_text('Carrier responsibility: booked; provider observation: completed.',exact=True)).to_be_visible()
  after_carrier=read('/__test/summary')
  assert after_carrier['carrierBookings']==1 and after_carrier['providerPosts']==1,after_carrier
  assert after_carrier['stock']==8 and after_carrier['reserved']==3 and after_carrier['allocations']==2,after_carrier
  assert sum(v['delivered'] for v in after_carrier['progress'])==0,after_carrier
  page.screenshot(path='/private/tmp/phase-d-recovery-merchant.png',full_page=True)
  customer=browser.new_context();customer.route('**/*',local)
  customer.add_init_script("""(() => { const state="""+json.dumps(state)+""";sessionStorage.setItem('dh_token',state.customerToken);sessionStorage.setItem('dh_user',JSON.stringify(state.customer));})();""")
  purchase=customer.new_page();purchase.on('pageerror',lambda error:errors.append(str(error)))
  purchase.goto(SHOP+'/my-account/orders/'+state['orderId']);purchase.wait_for_load_state('networkidle')
  age=purchase.get_by_role('button',name='Yes, I am 18 or older',exact=True)
  if age.is_visible():age.click()
  progress=purchase.get_by_role('region',name='Shipments',exact=True)
  expect(progress.get_by_text(re.compile(r'Local delivery \d+: Return received by merchant'))).to_be_visible()
  expect(progress.get_by_text(re.compile(r'External carrier \d+: Carrier reports delivered'))).to_be_visible()
  assert 'Synthetic original goods physically received' not in progress.inner_text()
  assert 'quarantined' not in progress.inner_text()
  purchase.screenshot(path='/private/tmp/phase-d-recovery-customer.png',full_page=True)
  assert errors==[],errors
  print(json.dumps({'result':'passed','summary':summary,'carrier':after_carrier,'pageErrors':errors}))
 except Exception:
  print(json.dumps({'url':page.url,'body':page.locator('body').inner_text()[:18000],'pageErrors':errors}))
  page.screenshot(path='/private/tmp/phase-d-browser-failure.png',full_page=True)
  raise
 finally:browser.close()
