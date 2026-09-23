import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { TenantModalSelect } from './modal-select';

const options = [
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'growth', label: 'Growth' },
];

describe('TenantModalSelect', () => {
  it('keeps the option list inside the parent dialog', () => {
    const element = TenantModalSelect({
      label: 'Plan',
      options,
      value: 'free_trial',
      onChange: () => undefined,
    });

    expect(element.props.inPortal).toBe(false);
    expect(element.props.dropdownClassName).toContain('z-');
  });

  it('stores primitive option values and renders their labels', () => {
    const onChange = vi.fn();
    const element = TenantModalSelect({
      label: 'Plan',
      options,
      value: 'free_trial',
      onChange,
    });

    expect(element.props.getOptionValue(options[1])).toBe('growth');
    expect(element.props.displayValue('growth')).toBe('Growth');
    element.props.onChange('growth');
    expect(onChange).toHaveBeenCalledWith('growth');
  });
});
