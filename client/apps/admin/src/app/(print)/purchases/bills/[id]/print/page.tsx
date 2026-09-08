'use client';
import { use } from 'react';
import DirectDocumentPrint from '@/app/shared/document-templates/direct-document-print';
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <DirectDocumentPrint id={id} kind="bill" />;
}
