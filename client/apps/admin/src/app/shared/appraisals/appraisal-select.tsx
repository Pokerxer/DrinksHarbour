'use client';
import { useId } from 'react';
import {
  Listbox,
  ListboxButton,
  ListboxOptions,
  ListboxOption,
} from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
export interface AppraisalSelectOption {
  value: string;
  label: string;
  description?: string;
}
export default function AppraisalSelect({
  label,
  value,
  options,
  onChange,
  disabled = false,
  showSelectedDescription = false,
}: {
  label: string;
  value: string;
  options: AppraisalSelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  showSelectedDescription?: boolean;
}) {
  const id = useId();
  const selected = options.find((option) => option.value === value);
  return (
    <div className="min-w-0 space-y-1.5">
      <label htmlFor={id} className="block text-xs font-medium text-gray-600">
        {label}
      </label>
      <Listbox
        value={value}
        onChange={onChange}
        disabled={disabled || !options.length}
      >
        <ListboxButton
          id={id}
          aria-label={label}
          aria-describedby={`${id}-value`}
          className="group flex min-h-11 w-full min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-left text-sm text-gray-900 shadow-sm outline-none transition-colors hover:border-gray-400 focus-visible:border-[#b20202] focus-visible:ring-2 focus-visible:ring-[#b20202]/15 disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400 disabled:shadow-none data-[open]:border-[#b20202] data-[open]:ring-2 data-[open]:ring-[#b20202]/10"
        >
          <span id={`${id}-value`} className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              {selected?.label ?? 'Choose an option'}
            </span>
            {showSelectedDescription && selected?.description && (
              <span className="mt-0.5 block truncate text-xs font-normal text-gray-500">
                {selected.description}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-gray-400 transition-transform group-data-[open]:rotate-180 motion-reduce:transition-none"
          />
        </ListboxButton>
        <ListboxOptions
          anchor={{ to: 'bottom start', gap: 6, padding: 12 }}
          portal
          modal={false}
          className="z-[1000] max-h-72 w-[var(--button-width)] max-w-[calc(100vw-24px)] overflow-y-auto overscroll-contain rounded-xl border border-gray-200 bg-white p-1.5 shadow-xl outline-none"
        >
          {options.map((option) => (
            <ListboxOption
              key={option.value}
              value={option.value}
              className="group flex min-h-11 cursor-pointer select-none items-start gap-3 rounded-lg px-3 py-2.5 text-sm text-gray-700 outline-none data-[focus]:bg-gray-100 data-[selected]:bg-red-50 data-[selected]:data-[focus]:bg-red-100 data-[selected]:text-[#790505]"
            >
              {({ selected }) => (
                <>
                  <span className="min-w-0 flex-1 break-words">
                    <span className="block font-medium">{option.label}</span>
                    {option.description && (
                      <span className="mt-0.5 block text-xs leading-5 text-gray-500">
                        {option.description}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 h-4 w-4 shrink-0">
                    {selected && (
                      <Check
                        aria-hidden="true"
                        className="h-4 w-4 text-[#b20202]"
                      />
                    )}
                  </span>
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </Listbox>
    </div>
  );
}
