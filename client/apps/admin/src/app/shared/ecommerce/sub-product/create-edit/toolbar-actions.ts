export interface ToolbarNavigation {
  busy: boolean;
  editing: boolean;
  dirty: boolean;
  validate: () => Promise<boolean>;
  save: () => Promise<boolean>;
  navigate: () => void;
}

export async function navigateFromToolbar(
  options: ToolbarNavigation
): Promise<boolean> {
  if (options.busy) return false;
  if (options.editing && options.dirty) {
    if (!(await options.validate())) return false;
    if (!(await options.save())) return false;
  }
  options.navigate();
  return true;
}
