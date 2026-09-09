'use client';

import React, { useEffect, useState } from 'react';
import { warehouseService, type Warehouse } from '@/services/warehouse.service';

export default function POSLocationSelect({ token, value, onChange }: {
  token: string; value: string; onChange: (id: string) => void;
}) {
  const [locations, setLocations] = useState<Warehouse[]>([]);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    warehouseService.getWarehouses(token, { isActive: true }).then(response => {
      const rows = (response as { data: Warehouse[] }).data;
      if (!cancelled) setLocations(rows.filter(row => row.posEnabled !== false));
    }).catch(() => { if (!cancelled) setError('Unable to load stock locations.'); });
    return () => { cancelled = true; };
  }, [token]);
  return <label className="block space-y-1.5 text-sm font-medium text-gray-700">
    <span>Stock location</span>
    <select required value={value} onChange={event => onChange(event.target.value)}
      className="w-full rounded-lg border border-gray-200 px-3 py-2">
      <option value="">Select a location</option>
      {locations.map(location => <option key={location._id} value={location._id}>{location.name}</option>)}
    </select>
    <span className="block text-xs font-normal">This POS only displays and sells stock from this location.</span>
    {error && <span role="alert" className="block text-red-600">{error}</span>}
  </label>;
}
