'use client';

import type { Warehouse } from '@/services/warehouse.service';

export default function MarketplaceWarehousePicker({
  warehouses,
  selected,
  onChange,
}: {
  warehouses: Warehouse[];
  selected: string[];
  onChange: (warehouseIds: string[]) => void;
}) {
  const active = warehouses.filter((warehouse) => warehouse.isActive);
  const unavailable = selected.filter((id) => !active.some((warehouse) => warehouse._id === id));

  return (
    <fieldset className="min-w-0 px-6 py-3.5">
      <legend className="float-left w-full text-[13.5px] text-gray-800">
        DrinksHarbour marketplace warehouses
      </legend>
      <p className="clear-both pt-0.5 text-xs text-gray-500">
        DrinksHarbour displays combined stock from these warehouses. Checkout uses your default warehouse.
        Clear all selections to use your existing stock settings.
      </p>
      <div className="mt-2 grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
        {active.map((warehouse) => (
          <label key={warehouse._id} className="flex items-center gap-2 text-sm text-gray-800">
            <input
              type="checkbox"
              checked={selected.includes(warehouse._id)}
              onChange={(event) => onChange(event.target.checked
                ? [...selected, warehouse._id]
                : selected.filter((id) => id !== warehouse._id))}
              className="accent-[#b20202]"
            />
            {warehouse.name}{warehouse.code ? ` (${warehouse.code})` : ''}
          </label>
        ))}
        {unavailable.map((id) => (
          <label key={id} className="flex items-center gap-2 text-sm text-gray-600">
            <input type="checkbox" checked onChange={() => onChange(selected.filter((value) => value !== id))} />
            Unavailable warehouse
          </label>
        ))}
        {!active.length && !unavailable.length && <p className="text-sm text-gray-500">No active warehouses available.</p>}
      </div>
    </fieldset>
  );
}
