import type { ReactNode } from 'react';

export default function SettingsPageHeader({
  title,
  description,
  eyebrow = 'Workspace settings',
  children,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-5 border-b border-muted pb-6">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-widest text-primary">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
          {title}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-500">{description}</p>
      </div>
      {children}
    </header>
  );
}
