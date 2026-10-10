// client/apps/admin/src/app/shared/sales/sales-clearable-fields.ts
//
// The edit screen owns these scalars outright: whatever the form holds is what
// the document should say. That is only true if an *emptied* field is actually
// sent, and it used not to be.
//
// applyEdit applies each one with `if (body.x !== undefined)`, so on the wire
// `undefined` means "leave this field alone" while `''`/`null` mean "clear it".
// The form built its payload with `value || undefined`, which collapsed an
// emptied box to exactly the "leave it alone" signal: the operator cleared the
// note, pressed save, and the note came straight back. The clearing was silent
// because the save itself succeeded.
//
// The two empties differ by type, which is the whole reason this is a function
// rather than three `||` operators to copy wrong:
//   - notes / terms are Strings and clear with `''`.
//   - validUntil is a Date and warehouseId an ObjectId ref; `''` is not a value
//     either cast accepts, so they clear with `null`.

/** Shape the create/edit form holds these in. */
export interface ClearableSalesFields {
  notes: string;
  terms: string;
  validUntil: string;
  warehouseId: string;
}

export interface ClearableSalesPayload {
  notes: string;
  terms: string;
  validUntil: string | null;
  warehouseId: string | null;
}

export function clearableSalesFields(
  f: ClearableSalesFields
): ClearableSalesPayload {
  return {
    notes: f.notes,
    terms: f.terms,
    validUntil: f.validUntil || null,
    warehouseId: f.warehouseId || null,
  };
}
