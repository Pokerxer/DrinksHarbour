"""Synthetic local review and customer shipment journey through actual Next/API."""
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta
from playwright.sync_api import sync_playwright, expect

API = "http://127.0.0.1:39140"
ADMIN = "http://127.0.0.1:39142"
SHOP = "http://127.0.0.1:39143"

def read(path):
    with urllib.request.urlopen(API + path, timeout=30) as response:
        return json.load(response)

def warm(url, cookie=None):
    req = urllib.request.Request(url, headers={"Cookie": "next-auth.session-token=" + cookie} if cookie else {})
    with urllib.request.urlopen(req, timeout=180) as response:
        assert response.status == 200

def local_only(route):
    url = route.request.url
    allowed = (API + "/", ADMIN + "/", SHOP + "/", "http://localhost:39142/")
    route.continue_() if url.startswith(allowed) else route.abort()

state = read("/__test/state")
warm(ADMIN + "/delivery-settings", state["adminCookie"])
warm(SHOP + "/my-account/orders/" + state["orderId"])
with sync_playwright() as p:
    browser = p.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context()
    context.route("**/*", local_only)
    context.add_cookies([{"name": "next-auth.session-token", "value": state["adminCookie"],
                         "url": ADMIN, "httpOnly": True, "sameSite": "Lax"}])
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(ADMIN + "/delivery-settings")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Delivery settings", exact=True)).to_be_visible()
    page.get_by_label("Location", exact=True).select_option(state["location"])
    expect(page.get_by_role("heading", name="No reviewed delivery terms", exact=True)).to_be_visible()
    expect(page.get_by_text("New booking creation is disabled.", exact=False)).to_be_visible()
    values = {"Accepted charge (kobo)": "0", "Maximum units": "10",
              "Maximum weight (grams)": "10000", "State": "FCT", "City": "Abuja",
              "Minimum latitude": "9", "Maximum latitude": "9.1",
              "Minimum longitude": "7.3", "Maximum longitude": "7.5",
              "Review evidence": "Synthetic browser review only; not operational approval"}
    for label, value in values.items():
        page.get_by_label(label, exact=True).fill(value)
    page.get_by_label("Valid until", exact=True).fill((datetime.now() + timedelta(days=2)).strftime("%Y-%m-%dT%H:%M"))
    page.get_by_label("Country", exact=True).select_option("Nigeria")
    page.get_by_label("bike", exact=True).check()
    for label in ["Alcohol handling", "Age verification", "Fragile handling"]:
        page.get_by_label(label, exact=True).select_option("yes")
    page.get_by_role("button", name="Review exact terms", exact=True).click()
    expect(page.get_by_role("region", name="Confirm review", exact=True)).to_be_visible()
    with page.expect_response(lambda r: r.url.endswith("/contracts") and r.request.method == "POST") as saved:
        page.get_by_role("button", name="Confirm reviewed terms", exact=True).click()
    assert saved.value.status == 201, saved.value.text()
    expect(page.get_by_role("heading", name="Current review: reviewed", exact=True)).to_be_visible()
    page.get_by_role("button", name="Revoke version 1", exact=True).click()
    with page.expect_response(lambda r: r.url.endswith("/revoke") and r.request.method == "POST") as revoked:
        page.get_by_role("button", name="Confirm revocation", exact=True).click()
    assert revoked.value.status == 200, revoked.value.text()
    expect(page.get_by_role("heading", name="Current review: revoked", exact=True)).to_be_visible()
    page.screenshot(path="/private/tmp/delivery-settings-browser-verified.png", full_page=True)
    assert errors == [], errors

    tenant = browser.new_context()
    tenant.route("**/*", local_only)
    tenant.add_cookies([{"name": "next-auth.session-token", "value": state["tenantCookie"],
                        "url": ADMIN, "httpOnly": True, "sameSite": "Lax"}])
    denied = tenant.new_page()
    denied.goto(ADMIN + "/delivery-settings")
    expect(denied).to_have_url(re.compile(r"/access-denied$"))
    tenant.close()

    customer = browser.new_context()
    customer.route("**/*", local_only)
    customer_session = {"customer": state["customer"], "customerToken": state["customerToken"]}
    customer.add_init_script("""(() => { const state = """ + json.dumps(customer_session) + """;
      sessionStorage.setItem('dh_token', state.customerToken);
      sessionStorage.setItem('dh_user', JSON.stringify(state.customer));
    })();""")
    purchase = customer.new_page()
    customer_errors = []
    purchase.on("pageerror", lambda error: customer_errors.append(str(error)))
    purchase.goto(SHOP + "/my-account/orders/" + state["orderId"])
    purchase.wait_for_load_state("networkidle")
    age = purchase.get_by_role("button", name="Yes, I am 18 or older", exact=True)
    if age.is_visible():
        age.click()
    progress = purchase.get_by_role("region", name="Shipments", exact=True)
    expect(progress.get_by_role("heading", name="Shipment progress", exact=True)).to_be_visible()
    expect(progress.get_by_role("heading", name="Browser shop 1 — Partially shipped", exact=True)).to_be_visible()
    expect(progress.get_by_role("heading", name="Browser shop 2 — Awaiting merchant", exact=True)).to_be_visible()
    expect(progress.get_by_text("1 shipped · 0 delivered · 0 cancelled", exact=True)).to_be_visible()
    expect(progress.get_by_text(re.compile("not live GPS"))).to_be_visible()
    purchase.screenshot(path="/private/tmp/customer-shipments-browser-verified.png", full_page=True)
    purchase.goto(SHOP + "/order-tracking?orderId=" + state["orderNumber"])
    expect(purchase.get_by_role("heading", name="Shipment progress", exact=True)).to_be_visible()
    req = urllib.request.Request(API + "/api/customer-shipments/" + state["orderId"],
                                 headers={"Authorization": "Bearer " + state["strangerToken"]})
    try:
        urllib.request.urlopen(req, timeout=30)
        raise AssertionError("Foreign customer shipment read succeeded")
    except urllib.error.HTTPError as error:
        assert error.code == 404
    assert customer_errors == [], customer_errors
    customer.close()
    context.close()
    browser.close()
    print(json.dumps({"passed": ["explicit platform review and revoke", "tenant denied review screen",
                                  "own mixed-merchant partial progress", "account and tracking routes",
                                  "foreign customer denied"], "productionActivation": False}))
