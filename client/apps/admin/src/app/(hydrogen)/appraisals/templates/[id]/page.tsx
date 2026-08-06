'use client';
import { use } from 'react';
import TemplateEditor from '@/app/shared/appraisals/template-editor';

// `id === 'new'` is the create case — /appraisals/templates/new resolves here
// rather than needing its own route, exactly as the editor expects.
export default function AppraisalTemplateEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <TemplateEditor id={id} />;
}
