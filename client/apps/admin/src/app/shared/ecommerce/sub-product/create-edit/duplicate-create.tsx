'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { SubProductInput } from '@/validators/sub-product.schema';
import CreateEditSubProduct from './index';
import { loadDuplicateTemplate } from './load-duplicate-template';
import { clearSubProductDraft } from './draft-cleanup';

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; values: SubProductInput };

export default function DuplicateSubProductCreate({
  sourceId,
  onStartBlank,
}: {
  sourceId: string;
  onStartBlank: () => void;
}) {
  const { data: session, status } = useSession();
  const token = session?.user?.token;
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    clearSubProductDraft();
    if (!token) return;
    let cancelled = false;
    setState({ status: 'loading' });
    async function load() {
      const values = await loadDuplicateTemplate(sourceId, token!);
      if (!cancelled) setState({ status: 'ready', values });
    }
    load().catch((error: unknown) => {
      if (!cancelled)
        setState({
          status: 'error',
          message:
            error instanceof Error
              ? error.message
              : 'Unable to copy this product.',
        });
    });
    return () => {
      cancelled = true;
    };
  }, [sourceId, token]);

  if (status === 'unauthenticated' || state.status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 p-6">
        <p>
          {state.status === 'error'
            ? state.message
            : 'Sign in to duplicate a product.'}
        </p>
        <button
          type="button"
          className="mt-3 inline-block underline"
          onClick={onStartBlank}
        >
          Start a blank sub-product
        </button>
      </div>
    );
  }
  if (!token || state.status !== 'ready') {
    return (
      <p role="status" className="p-6 text-gray-500">
        Copying product details…
      </p>
    );
  }
  return (
    <>
      <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        <p className="font-semibold">Create from a copy</p>
        <p>
          Update the name and details for your new product, then save. Stock,
          SKUs and barcodes have been cleared. Nothing has been saved yet.
        </p>
      </div>
      <CreateEditSubProduct
        product={state.values}
        onStartBlank={onStartBlank}
      />
    </>
  );
}
