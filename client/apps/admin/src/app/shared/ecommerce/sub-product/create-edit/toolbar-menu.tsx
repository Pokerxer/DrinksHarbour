'use client';

import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { PiArchive, PiCopy, PiDotsThree, PiTrash } from 'react-icons/pi';

export interface ToolbarMenuProps {
  disabled: boolean;
  archived: boolean;
  onDuplicate: () => void;
  onArchive: () => void;
  onDelete: () => void;
}

export default function ToolbarMenu(props: ToolbarMenuProps) {
  const actions = [
    { label: 'Duplicate product', icon: PiCopy, action: props.onDuplicate },
    {
      label: props.archived ? 'Restore product' : 'Archive product',
      icon: PiArchive,
      action: props.onArchive,
    },
    {
      label: 'Delete product',
      icon: PiTrash,
      action: props.onDelete,
      destructive: true,
    },
  ];
  return (
    <Menu as="div" className="relative shrink-0">
      <MenuButton
        disabled={props.disabled}
        aria-label="More product actions"
        className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-900 disabled:opacity-40"
      >
        <PiDotsThree aria-hidden="true" className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        anchor="bottom end"
        modal={false}
        className="z-[80] w-56 max-w-[calc(100vw-2rem)] rounded-xl border border-gray-200 bg-white p-1.5 shadow-lg outline-none [--anchor-gap:8px]"
      >
        {actions.map(({ label, icon: Icon, action, destructive }) => (
          <MenuItem key={label} disabled={props.disabled}>
            <button
              type="button"
              onClick={action}
              className={`flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm data-[focus]:bg-gray-100 data-[disabled]:opacity-40 ${destructive ? 'mt-1 border-t border-gray-100 text-red-600' : 'text-gray-700'}`}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              {label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}
