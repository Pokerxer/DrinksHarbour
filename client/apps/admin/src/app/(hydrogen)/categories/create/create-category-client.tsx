// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import CreateCategory from '@/app/shared/ecommerce/category/create-category';

export default function CreateCategoryClient() {
  const params = useSearchParams();
  const [aiDraft, setAiDraft] = useState<any>(null);

  useEffect(() => {
    if (params?.get('ai') !== '1') return;
    try {
      const raw = sessionStorage.getItem('categoryAiDraft');
      if (raw) {
        setAiDraft(JSON.parse(raw));
        sessionStorage.removeItem('categoryAiDraft');
      }
    } catch {}
  }, [params]);

  return <CreateCategory isModalView={false} aiDraft={aiDraft} />;
}