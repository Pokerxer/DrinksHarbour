# Location-linked POS

Warehouse remains the physical location model. Its existing `store` type is
shown as Physical storefront / shop. `posEnabled` is independent of type and
defaults to true for backwards compatibility. Disable it to prevent POS sales.

Retail is the only built-in POS. Its selected location is stored on
`Tenant.posSettings.retailWarehouse`. Every additional terminal requires an
active same-tenant stock location. Edit existing bindings in Settings > POS.
`posLocation.service.js` resolves both plain and Mongoose tenant documents;
unavailable, disabled and unbound terminals fail closed. Retail falls back to
the active default POS-enabled warehouse until an explicit location is selected;
Wholesale is created like any other additional terminal.

Catalogue and checkout use the binding. Catalogue warehouse overrides cannot
change it. Checkout uses tenant-scoped SubProducts, validates size ownership and
atomically refuses insufficient location stock even if overselling is enabled.
Offline catalogue entries are scoped to the session token hash and POS ID;
refresh replaces the cache so removed products do not reappear offline.

Billing counts one Retail terminal plus configured additional terminals. No
tenant records were migrated and no Wyn City location was guessed. Online
checkout routing is unchanged.

Billing correction (2026-09-09): usage remains 1 Retail + created POS rows on
every plan. Never add plan.posLimit to usage. Plan capacity only determines the
allowance; Growth must be able to create its second terminal without an add-on.
Billing displays included/paid capacity and links to location/POS management.
