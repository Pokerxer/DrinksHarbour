'use client';
import { Select } from 'rizzui/select';
import { PiCheck } from 'react-icons/pi';
import { EDITOR_LABEL, EDITOR_MENU } from './sales-dropdown-styles';

export interface EditorOption {
  value: string;
  label: string;
  badge?: string;
  disabled?: boolean;
}

export default function SalesEditorSelect({
  label,
  options,
  value,
  onChange,
  searchable = false,
  searchPlaceholder,
  disabled = false,
}: {
  label: string;
  options: EditorOption[];
  value: string;
  onChange: (value: string) => void;
  searchable?: boolean;
  searchPlaceholder?: string;
  disabled?: boolean;
}) {
  return (
    <Select
      label={label}
      labelClassName={EDITOR_LABEL}
      selectClassName="min-h-11 rounded-[10px] border-gray-200 bg-white text-sm text-gray-900 focus:ring-2 focus:ring-brand/20"
      options={options}
      value={value}
      onChange={onChange}
      disabled={disabled}
      searchable={searchable}
      searchByKey="label"
      searchPlaceHolder={searchPlaceholder}
      searchProps={{ 'aria-label': `Search ${label.toLowerCase()}` }}
      stickySearch
      searchClassName="text-sm"
      searchContainerClassName="border-b border-gray-100 pb-2 mb-1"
      optionClassName="min-h-11 rounded-lg px-3 py-2 text-sm hover:bg-red-50 data-[focus]:bg-red-50 data-[selected]:bg-red-50"
      getOptionValue={(option) => option.value}
      getOptionDisplayValue={(option) => (
        <span className="flex w-full min-w-0 items-center gap-2">
          <span className="min-w-0 flex-1 whitespace-normal break-words text-left">
            {option.label}
          </span>
          {option.badge && (
            <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-600">
              {option.badge}
            </span>
          )}
          {value === option.value && (
            <PiCheck
              aria-hidden="true"
              className="h-4 w-4 shrink-0 text-brand"
            />
          )}
        </span>
      )}
      displayValue={(id) =>
        options.find((option) => option.value === id)?.label ||
        options[0]?.label ||
        'Select an option'
      }
      inPortal={false}
      dropdownClassName={`${EDITOR_MENU} max-h-72 overflow-y-auto`}
    />
  );
}
