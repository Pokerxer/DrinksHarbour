// @ts-nocheck
'use client';

import React from 'react';
import PageHeader from '@/app/shared/page-header';
import { Button, Title, ActionIcon } from 'rizzui';
import CreateTenant from '@/app/shared/ecommerce/tenant/create-tenant';
import { PiPlusBold, PiXBold } from 'react-icons/pi';
import { useModal } from '@/app/shared/modal-views/use-modal';

function CreateTenantModalView({ onCreated }: { onCreated: () => void }) {
  const { closeModal } = useModal();
  return (
    <div className="m-auto px-5 pb-8 pt-5 @lg:pt-6 @2xl:px-7">
      <div className="mb-7 flex items-center justify-between">
        <Title as="h4" className="font-semibold">
          Add Tenant
        </Title>
        <ActionIcon size="sm" variant="text" onClick={closeModal}>
          <PiXBold className="h-auto w-5" />
        </ActionIcon>
      </div>
      <CreateTenant
        isModalView
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

export default function TenantPageHeader({
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
              <CreateTenantModalView
                onCreated={() => window.dispatchEvent(new Event('tenant-created'))}
              />
            ),
            customSize: 720,
          })
        }
      >
        <PiPlusBold className="me-1 h-4 w-4" />
        Add Tenant
      </Button>
    </PageHeader>
  );
}
