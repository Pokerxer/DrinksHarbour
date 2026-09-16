'use client';

import { PiArrowUp, PiArrowDown, PiArrowsDownUp } from 'react-icons/pi';

export function SortChevron({
  active,
  dir,
}: {
  active: boolean;
  dir: 'asc' | 'desc';
}) {
  if (!active) return <PiArrowsDownUp className="h-3 w-3 text-gray-300" />;
  return dir === 'asc' ? (
    <PiArrowUp className="h-3 w-3 text-[#b20202]" />
  ) : (
    <PiArrowDown className="h-3 w-3 text-[#b20202]" />
  );
}
