// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import SubCategoryAiBar from '@/app/shared/ecommerce/subcategory/subcategory-ai-bar';
import { getAdminCategories } from '@/services/category.service';

export default function SubCategoriesAiSection() {
  const router = useRouter();
  const { data: session } = useSession();
  const token = (session as any)?.user?.token || '';
  const [parentOptions, setParentOptions] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    if (!token) return;
    getAdminCategories(token)
      .then(({ categories }) => {
        setParentOptions(categories.map((c) => ({ value: c._id, label: c.name })));
      })
      .catch(() => {});
  }, [token]);

  const handleApply = (data: any) => {
    try {
      sessionStorage.setItem('subCategoryAiDraft', JSON.stringify(data));
    } catch {}
    router.push('/sub-categories/create?ai=1');
  };

  return (
    <SubCategoryAiBar token={token} onApply={handleApply} parentOptions={parentOptions} />
  );
}