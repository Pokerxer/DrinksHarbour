---
name: sales-clearable-field-contract
description: On the sales edit form, an emptied field must be sent as an empty value (notes/terms as '', validUntil/warehouseId as null) because applyEdit treats undefined as "leave unchanged". Also: the background autosave must use PUT, never PATCH.
type: memory
---

# Sales edit: the clearable-field contract

## `undefined` means "leave this alone", not "clear it"

`applyEdit` (server/services/salesOrder.service.js) applies every scalar as:

```js
if (body.notes !== undefined) so.notes = body.notes;
```

So on the wire **`undefined` = no change** and **`''`/`null` = clear**. The edit
form used to build its payload with `value || undefined`, which turns an emptied
box into precisely the "no change" signal: the operator cleared the note,
pressed save, got a success toast, and the note came straight back. Silent,
because the save genuinely succeeded.

The rule is now in one place,
`client/apps/admin/src/app/shared/sales/sales-clearable-fields.ts`, and the
`clearableSalesFields` spread sits in `useSalesCreateForm.buildPayload`. The
empty value differs by type, which is the only reason it is a function:

| Field | Type | Clears with |
|---|---|---|
| `notes`, `terms` | String | `''` |
| `validUntil` | Date | `null` |
| `warehouseId` | ObjectId ref | `null` |

`''` is not a value a Date or an ObjectId cast accepts, so those must be `null`.

**When adding a field the form owns end-to-end, send the empty value.** Never
`x || undefined`. If a field has a genuine "absent" state distinct from "empty",
that needs `null` on purpose and a comment saying so — not a truthy fallback.

## The background save is PUT, and its failure is not optional to check

`salesOrder.routes.js` registers only `.get().put().delete()` on `/:id`. The
background save in `useSalesAutosave` sent **`PATCH`**, which falls through to a
404 — proven live:

```
PATCH /api/sales-orders/<id>  → 404  Route PATCH ... not found
PUT   /api/sales-orders/<id>  → 200
```

The `fetch` was never awaited and its response never read, so navigating away
discarded the edit and the status still read "saved". It is now awaited and
reports `error` on a non-2xx. **A fire-and-forget save that never checks
`res.ok` is not a save.** Note `bgSave` runs on `beforeunload`, so it uses raw
`fetch` with `keepalive` rather than the service wrapper — that is the one place
the request is built by hand, and it is where a method typo hides.

## Also fixed there: the populated warehouse was sent as the id

`buildPayload` sent `warehouseId || undefined` while the form state holds
`string | PopulatedWarehouse` — a loaded order arrives populated
(`{ _id, name }`), so the whole object went out as the id. The hook already
derived `warehouseIdStr` for exactly this; the payload now uses it.

## Before touching this

`handleManualSave` in `useSalesAutosave` early-returns when there are no product
lines (`if (productLines.length === 0) return`), so a notes-only or note-line-only
document cannot be saved at all. That is a separate, still-open limitation.
