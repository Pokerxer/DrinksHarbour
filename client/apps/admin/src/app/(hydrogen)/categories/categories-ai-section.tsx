// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import CategoryAiBar from '@/app/shared/ecommerce/category/category-ai-bar';
import { getAdminCategories } from '@/services/category.service';

export default function CategoriesAiSection() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.user?.token || '';
  const [parentOptions, setParentOptions] = useState([
    { value: '', label: 'None (top-level)' },
  ]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        setParentOptions([
          { value: '', label: 'None (top-level)' },
          ...categories.map((c) => ({ value: c._id, label: c.name })),
        ]);
      })
      .catch(() => {});
  }, [token]);

  const handleApply = (data: any) => {
    try {
      sessionStorage.setItem('categoryAiDraft', JSON.stringify(data));
    } catch {}
    router.push('/categories/create?ai=1');
  };

  return (
    <CategoryAiBar token={token} onApply={handleApply} parentOptions={parentOptions} />
  );
}