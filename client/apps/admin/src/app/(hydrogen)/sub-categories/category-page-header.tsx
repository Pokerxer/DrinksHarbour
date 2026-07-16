// @ts-nocheck
'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import PageHeader from '@/app/shared/page-header';
import { Button, Title, ActionIcon } from 'rizzui';
import CreateSubCategory from '@/app/shared/ecommerce/subcategory/create-subcategory';
import SubCategoryAiBar from '@/app/shared/ecommerce/subcategory/subcategory-ai-bar';
import { PiPlusBold, PiXBold } from 'react-icons/pi';
import { useModal } from '@/app/shared/modal-views/use-modal';

function CreateSubCategoryModalView({ onCreated }: { onCreated: () => void }) {
  const { closeModal } = useModal();
  const { data: session } = useSession();
  const [aiDraft, setAiDraft] = useState<any>(null);
  return (
    <div className="m-auto w-full max-w-[820px] px-5 pb-8 pt-5 @lg:pt-6 @2xl:px-7">
      <div className="mb-7 flex items-center justify-between">
        <Title as="h4" className="font-semibold">
          Add SubCategory
        </Title>
        <ActionIcon size="sm" variant="text" onClick={closeModal}>
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>
      <div className="mb-5">
        <SubCategoryAiBar
          token={(session as any)?.user?.token || ''}
          onApply={setAiDraft}
          parentOptions={[]}
        />
      </div>
      <CreateSubCategory
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

export default function SubCategoryPageHeader({
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
              <CreateSubCategoryModalView
                onCreated={() => window.dispatchEvent(new Event('subcategory-created'))}
              />
            ),
            customSize: 720,
          })
        }
      >
        <PiPlusBold className="me-1 h-4 w-4" />
        Add SubCategory
      </Button>
    </PageHeader>
  );
}
