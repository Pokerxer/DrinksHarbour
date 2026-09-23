export interface SaveContext {
  isEditMode: boolean;
  id?: string;
  slug?: string;
  explicitCreate?: boolean;
}

export function subProductSaveTarget(
  context: SaveContext
): { kind: 'update'; id: string } | { kind: 'create' } | null {
  if (context.isEditMode) {
    const id = context.id || context.slug;
    return id ? { kind: 'update', id } : null;
  }
  return context.explicitCreate ? { kind: 'create' } : null;
}
