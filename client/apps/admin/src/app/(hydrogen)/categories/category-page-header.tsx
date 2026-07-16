// @ts-nocheck
'use client';

import React, { useState } from 'react';
import PageHeader from '@/app/shared/page-header';
import { Button, Title, ActionIcon } from 'rizzui';
import CreateCategory from '@/app/shared/ecommerce/category/create-category';
import CategoryAiBar from '@/app/shared/ecommerce/category/category-ai-bar';
import { PiPlusBold, PiXBold } from 'react-icons/pi';
import { useModal } from '@/app/shared/modal-views/use-modal';
import { useSession } from 'next-auth/react';

function CreateCategoryModalView({ onCreated }: { onCreated: () => void }) {
  const { closeModal } = useModal();
  const { data: session } = useSession();
  const [aiDraft, setAiDraft] = useState<any>(null);
  return (
    <div className="m-auto w-full max-w-[820px] px-5 pb-8 pt-5 @lg:pt-6 @2xl:px-7">
      <div className="mb-7 flex items-center justify-between">
        <Title as="h4" className="font-semibold">
          Add Category
        </Title>
        <ActionIcon size="sm" variant="text" onClick={closeModal}>
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>
      <div className="mb-5">
        <CategoryAiBar
          token={(session as any)?.user?.token || ''}
          onApply={setAiDraft}
          parentOptions={[{ value: '', label: 'None (top-level)' }]}
        />
      </div>
      <CreateCategory
        isModalView
        aiDraft={aiDraft}
        onSuccess={() => {
          closeModal();
          onCreated();
        }}
      />
    </div>
  );
}

type PageHeaderTypes = {
  title: string;
  breadcrumb: { name: string; href?: string }[];
  className?: string;
};

export default function CategoryPageHeader({
  title,
  breadcrumb,
  className,
}: PageHeaderTypes) {
  const { openModal } = useModal();

  return (
    <PageHeader title={title} breadcrumb={breadcrumb} className={className}>
      <Button
        as="span"
        className="mt-4 w-full cursor-pointer @lg:mt-0 @lg:w-auto"
        onClick={() =>
          openModal({
            view: (
              <CreateCategoryModalView
                onCreated={() => window.dispatchEvent(new Event('category-created'))}
              />
            ),
            customSize: 720,
          })
        }
      >
        <PiPlusBold className="me-1 h-4 w-4" />
        Add Category
      </Button>
    </PageHeader>
  );
}
