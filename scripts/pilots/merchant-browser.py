"""Actual Next merchant screen + actual local JWT/stock API, no provider calls."""
import json
import urllib.request
from playwright.sync_api import sync_playwright, expect

API = "http://127.0.0.1:39140"
APP = "http://127.0.0.1:39142"

def read(path):
    with urllib.request.urlopen(API + path) as response:
        return json.load(response)

with sync_playwright() as p:
    state = read("/__test/state")
    # Dev-only fixture readiness: compile the actual route before browser timing.
    warm = urllib.request.Request(APP + "/merchant-orders", headers={
        "Cookie": "next-auth.session-token=" + state["cookie"]})
    with urllib.request.urlopen(warm, timeout=180) as response:
        assert response.status == 200
    browser = p.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context()
    context.route("**/*", lambda route: route.continue_()
                  if route.request.url.startswith((API + "/", APP + "/"))
                  else route.abort())
    context.add_cookies([{"name": "next-auth.session-token", "value": state["cookie"],
                         "url": APP, "httpOnly": True, "sameSite": "Lax"}])
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(APP + "/merchant-orders")
    page.wait_for_load_state("networkidle")
    expect(page.get_by_role("heading", name="Merchant fulfillment", exact=True)).to_be_visible()
    expect(page.get_by_text("1 matching orders", exact=False)).to_be_visible()
    with page.expect_response(lambda response: response.url.endswith("/actions")
                              and response.request.method == "POST") as saved:
        page.get_by_role("button", name="Accept order", exact=True).click()
    assert saved.value.status == 200
    expect(page.get_by_role("button", name="Start picking", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="Ship order", exact=True)).to_have_count(0)
    expect(page.get_by_role("button", name="Cancel own order", exact=True)).to_have_count(0)
    page.get_by_label("Units for Quantity bottle", exact=True).first.fill("1")
    with page.expect_response(lambda response: response.url.endswith("/quantity/ship")
                              and response.request.method == "POST") as shipped:
        page.get_by_role("button", name="Ship selected units", exact=True).click()
    assert shipped.value.status == 201, shipped.value.text()
    expect(page.get_by_text("partially_shipped ·", exact=False)).to_be_visible()
    expect(page.get_by_role("button", name="Confirm shipment delivered", exact=True)).to_be_visible()
    with page.expect_response(lambda response: "/quantity/allocations/" in response.url
                              and response.url.endswith("/deliver")
                              and response.request.method == "POST") as delivered:
        page.get_by_role("button", name="Confirm shipment delivered", exact=True).click()
    assert delivered.value.status == 200
    expect(page.get_by_role("button", name="Confirm shipment delivered", exact=True)).to_have_count(0)
    with page.expect_response(lambda response: "/api/merchant-orders?state=open" in response.url
                              and response.request.method == "GET") as refreshed:
        page.get_by_role("button", name="Refresh queue", exact=True).click()
    assert refreshed.value.status == 200, refreshed.value.text()
    expect(page.get_by_text("Loading merchant orders…")).to_have_count(0)
    summary = read("/__test/summary")
    assert summary["stock"] == 9 and summary["reserved"] == 4, summary
    assert summary["allocations"] == summary["delivered"] == 1, summary
    assert sum(row["shipped"] for row in summary["progress"]) == 1, summary
    assert sum(row["delivered"] for row in summary["progress"]) == 1, summary
    try:
        page.get_by_label("Queue status", exact=True).select_option("closed")
    except Exception:
        print(json.dumps({"url": page.url, "errors": errors,
                          "body": page.locator("body").inner_text()[:12000]}))
        page.screenshot(path="/private/tmp/merchant-browser-failure.png", full_page=True)
        raise
    expect(page.get_by_text("No orders match this queue page.", exact=False)).to_be_visible()
    page.get_by_label("Queue status", exact=True).select_option("open")
    expect(page.get_by_text("1 matching orders", exact=False)).to_be_visible()
    page.screenshot(path="/private/tmp/merchant-browser-verified.png", full_page=True)
    assert errors == [], errors
    anonymous = browser.new_context()
    anonymous.route("**/*", lambda route: route.continue_()
                    if route.request.url.startswith((APP + "/", "http://localhost:39142/")) else route.abort())
    denied = anonymous.new_page()
    denied.goto(APP + "/merchant-orders")
    expect(denied).to_have_url(__import__("re").compile(r"/signin\?callbackUrl=%2Fmerchant-orders$"))
    anonymous.close()
    context.close()
    browser.close()
    print(json.dumps({"checks": "Next session, own queue, accept, partial ship, exact deliver, stock once, filters, anonymous denial", "summary": summary}))
