'use client';
import Image from 'next/image';
import type { DocumentTemplate } from '@/utils/print/templates/registry';
export default function TemplateCard({
  template: t,
  selected,
  onSelect,
}: {
  template: DocumentTemplate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`group rounded-xl border-2 p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 ${selected ? 'border-primary bg-primary/5' : 'border-muted bg-white hover:border-gray-400 dark:bg-gray-50'}`}
    >
      <Image
        src={`/document-template-thumbnails/${t.id}.webp`}
        alt=""
        width={425}
        height={600}
        className="mx-auto h-56 w-full rounded border border-gray-100 bg-white object-contain shadow-sm"
        sizes="(min-width: 1024px) 270px, (min-width: 400px) 50vw, 100vw"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="font-semibold text-gray-900">{t.name}</span>
        <span className="text-xs text-gray-600">
          {selected ? 'Selected ✓' : 'Choose'}
        </span>
      </div>
      <p className="mt-1 text-xs leading-5 text-gray-500">{t.description}</p>
    </button>
  );
}
