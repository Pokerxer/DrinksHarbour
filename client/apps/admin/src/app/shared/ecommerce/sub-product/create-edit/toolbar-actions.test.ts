import { describe, expect, it, vi } from 'vitest';
import { navigateFromToolbar } from './toolbar-actions';

const options = () => ({
  busy: false,
  editing: true,
  dirty: true,
  validate: vi.fn(async () => true),
  save: vi.fn(async () => true),
  navigate: vi.fn(),
});

describe('toolbar navigation', () => {
  it('keeps the current record open if validation fails', async () => {
    const action = options();
    action.validate.mockResolvedValue(false);
    expect(await navigateFromToolbar(action)).toBe(false);
    expect(action.save).not.toHaveBeenCalled();
    expect(action.navigate).not.toHaveBeenCalled();
  });
  it('keeps unsaved changes visible if saving fails', async () => {
    const action = options();
    action.save.mockResolvedValue(false);
    expect(await navigateFromToolbar(action)).toBe(false);
    expect(action.navigate).not.toHaveBeenCalled();
  });
  it('blocks navigation while another action is running', async () => {
    const action = { ...options(), busy: true };
    expect(await navigateFromToolbar(action)).toBe(false);
    expect(action.save).not.toHaveBeenCalled();
    expect(action.navigate).not.toHaveBeenCalled();
  });
  it('never saves a new product on navigation', async () => {
    const action = { ...options(), editing: false };
    expect(await navigateFromToolbar(action)).toBe(true);
    expect(action.save).not.toHaveBeenCalled();
    expect(action.navigate).toHaveBeenCalledOnce();
  });
  it('waits for a successful edit save before navigating', async () => {
    const events: string[] = [];
    const action = {
      ...options(),
      save: async () => {
        events.push('save');
        return true;
      },
      navigate: () => {
        events.push('navigate');
      },
    };
    expect(await navigateFromToolbar(action)).toBe(true);
    expect(events).toEqual(['save', 'navigate']);
  });
});
