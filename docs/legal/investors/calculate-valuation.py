"""Reproduce the explicitly assumed monthly scenarios; no external services."""
import csv
from decimal import Decimal as D
from pathlib import Path

ROOT = Path(__file__).resolve().parent
PRICES = (15000, 35000, 65000, 85000)
MIX = tuple(map(D, ('0.2', '0.4', '0.3', '0.1')))


def fee(amount):
    return min(D(amount) * D('0.015') + (100 if amount >= 2500 else 0), D(2000))


arpa = sum(D(price) * weight for price, weight in zip(PRICES, MIX))
subscription_fee = sum(fee(price) * weight for price, weight in zip(PRICES, MIX))
addon_revenue = D('0.10') * 12000 + D('0.05') * 20000
addon_fee = D('0.10') * fee(12000) + D('0.05') * fee(20000)
variable_service_cost = D(5000)
contribution = arpa + addon_revenue - subscription_fee - addon_fee - variable_service_cost
marketplace_rate = D('0.11')
marketplace_cost_rate = D('0.02') + D('0.03') + D('0.01') + D('0.02')
scenarios = [('Bear', 25, 2500000, 0), ('Early scale', 50, 3000000, 5000000),
             ('Base', 100, 4000000, 10000000), ('Bull', 200, 6000000, 40000000)]
rows = []
for name, tenants, fixed, gmv in scenarios:
    subscription = arpa * tenants
    addons = addon_revenue * tenants
    processing = (subscription_fee + addon_fee) * tenants
    service = variable_service_cost * tenants
    commission = D(gmv) * marketplace_rate
    market_cost = D(gmv) * marketplace_cost_rate
    operating = subscription + addons + commission - processing - service - market_cost - fixed
    rows.append(dict(state=name, tenants=tenants, subscription_revenue=subscription,
                     addon_revenue=addons, marketplace_gmv=gmv, marketplace_revenue=commission,
                     total_platform_revenue=subscription + addons + commission,
                     saas_processing_cost=processing, variable_service_cost=service,
                     marketplace_variable_cost=market_cost, fixed_operating_cost=fixed,
                     monthly_operating_result=operating))

with (ROOT / 'profit-scenarios.csv').open('w', newline='') as out:
    writer = csv.DictWriter(out, fieldnames=list(rows[0]))
    writer.writeheader()
    writer.writerows(rows)

print(f'Average subscription: {arpa}; SaaS contribution including add-ons: {contribution}')
for fixed in (2500000, 3000000, 4000000, 6000000):
    count = int((D(fixed) / contribution).to_integral_value(rounding='ROUND_CEILING'))
    without = int((D(fixed) / (arpa - subscription_fee - variable_service_cost))
                  .to_integral_value(rounding='ROUND_CEILING'))
    print(f'SaaS break-even at fixed costs {fixed}: {count} tenants; without add-ons {without}')
for row in rows:
    print(row['state'], row['total_platform_revenue'], row['monthly_operating_result'])
assert sum(MIX) == 1 and arpa == 45000 and subscription_fee == 775
assert contribution == 41377 and sum(fee(p) for p in (85000, 35000)) == 2000
assert rows[2]['monthly_operating_result'] == 437700
