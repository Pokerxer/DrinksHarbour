# Sales document money

Pure CommonJS module with TypeScript declarations. Both Express and the admin
editor import this file directly; deploy the repository's packages directory
alongside server/client source. No runtime dependency or installation step.

`lineAmounts` resolves gross, whole-line discount, promotion, untaxed amount and
tax to two decimals. `afterDiscount` is the existing stored SalesOrder lineTotal
contract (before promotion). `untaxed` is the displayed amount after promotion.
Presentation rows always return zero. Fixed discounts apply to the whole line;
percentage discounts scale with quantity. `convertDiscount` retains enough
percentage precision to preserve the monetary reduction to kobo.

`documentAmounts` adds rounded line amounts. `documentTotal` applies existing
coupon/spend discounts after line tax, floors at zero, then adds flat shipping.
Shipping tax and inclusive tax are outside this contract. Quantity and packaging
are not converted here. Product/tenant permissions stay at the existing callers.

Pure helpers defensively normalize invalid numeric inputs; API mutations reject
nonfinite/negative monetary input before persistence. Historical/issued snapshots
are displayed from storage; this module does not migrate or recalculate them.
