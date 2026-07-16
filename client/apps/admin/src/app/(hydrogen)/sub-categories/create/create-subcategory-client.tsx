// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CreateSubCategory from '@/app/shared/ecommerce/subcategory/create-subcategory';

export default function CreateSubCategoryClient() {
  const params = useSearchParams();
  const [aiDraft, setAiDraft] = useState<any>(null);

  useEffect(() => {
    if (params?.get('ai') !== '1') return;
    try {
      const raw = sessionStorage.getItem('subCategoryAiDraft');
      if (raw) {
        setAiDraft(JSON.parse(raw));
        sessionStorage.removeItem('subCategoryAiDraft');
      }
    } catch {}
  }, [params]);

  return <CreateSubCategory isModalView={false} aiDraft={aiDraft} />;
}