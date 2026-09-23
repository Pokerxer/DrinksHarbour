'use client';

import React from 'react';
import { Select } from 'rizzui';

export type TenantModalSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type TenantModalSelectProps = {
  label: string;
  options: TenantModalSelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
};

/**
 * Select configured for the global Headless UI dialog.
 *
 * RizzUI portals options to document.body by default. Headless UI then treats
 * those options as outside the active dialog, which blocks pointer and focus
 * interaction. Rendering the list beside its trigger keeps it inside the
 * dialog's focus boundary. Values stay primitive so react-hook-form stores the
 * schema enum rather than the whole option object.
 */
export function TenantModalSelect({
  label,
  options,
  value,
  onChange,
  placeholder,
  error,
}: TenantModalSelectProps) {
  return (
    <Select
      label={label}
      options={options}
      value={value ?? ''}
      onChange={(selected: string | TenantModalSelectOption) =>
        onChange(typeof selected === 'string' ? selected : selected.value)
      }
      getOptionValue={(option) => option.value}
      displayValue={(selected) =>
        options.find((option) => option.value === selected)?.label ?? ''
      }
      placeholder={placeholder}
      error={error}
      inPortal={false}
      dropdownClassName="z-50 h-auto max-h-64"
    />
  );
}
