'use client';
import { use } from 'react';
import { useSearchParams } from 'next/navigation';
import DirectDocumentPrint from '@/app/shared/document-templates/direct-document-print';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params); const search = useSearchParams();
  return <DirectDocumentPrint id={id} kind="sales" variant={search.get("type") === "proforma" ? "proforma" : undefined} />;
}
