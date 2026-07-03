'use client';

import Link from 'next/link';
import { PiArrowRight, PiWrenchDuotone } from 'react-icons/pi';

export interface ConfigPlaceholderProps {
  title: string;
  description: string;
  /** What this configuration will manage once the backend exists. */
  capabilities: string[];
  /** Existing pages that cover part of this today. */
  links?: { label: string; href: string }[];
  icon?: React.ReactNode;
}

/**
 * Empty-state page for inventory configuration areas that don't have a
 * backend model yet (operation types, storage categories, putaway rules,
 * package types, …). States plainly what will live here and points to the
 * closest existing tools instead of pretending to be functional.
 */
export default function InventoryConfigPlaceholder({
  title,
  description,
  capabilities,
  links,
  icon,
}: ConfigPlaceholderProps) {
  return (
    <div className="p-4 md:p-5 lg:p-6">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef2f2] text-[#b20202] [&>svg]:h-7 [&>svg]:w-7">
          {icon ?? <PiWrenchDuotone />}
        </span>
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-gray-500">
          {description}
        </p>

        <div className="mx-auto mt-6 max-w-md rounded-xl bg-gray-50 p-4 text-left">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Planned here
          </p>
          <ul className="space-y-1.5">
            {capabilities.map((c) => (
              <li
                key={c}
                className="flex items-start gap-2 text-sm text-gray-600"
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#b20202]/60" />
                {c}
              </li>
            ))}
          </ul>
        </div>

        {links && links.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:border-[#b20202]/30 hover:text-[#b20202]"
              >
                {l.label}
                <PiArrowRight className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        )}

        <p className="mt-6 text-xs text-gray-400">
          This configuration area is not wired to a backend yet — the pages
          above cover the closest workflows today.
        </p>
      </div>
    </div>
  );
}
