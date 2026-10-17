'use client';
import { useRef, useState } from 'react';
import { salesOrderService } from '@/services/salesOrder.service';
import { arApService } from '@/services/arAp.service';

export type InvoiceCreateAction = 'saving' | 'printing' | 'issuing' | null;
interface InvoiceActionOptions {
  token: string;
  orderId?: string;
  dueDate: string;
  saveError: string;
  issueError: string;
  disabled?: boolean;
  ensureSaved: (force?: boolean) => Promise<string | null>;
  onPrint: (id: string) => Promise<void>;
  onIssued: () => void;
}
export function useInvoiceCreateActions(options: InvoiceActionOptions) {
  const [action, setAction] = useState<InvoiceCreateAction>(null);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const run = async (kind: Exclude<InvoiceCreateAction, null>) => {
    if (pending.current || options.disabled) return;
    const invalid = kind === 'issuing' ? options.issueError : options.saveError;
    if (!options.token || invalid) {
      setError(invalid || 'Sign in to continue.');
      return;
    }
    pending.current = true;
    setAction(kind);
    setError('');
    try {
      // A lost response may have issued this same source. Check before flushing
      // edits: an issued source must never be written as a quotation again.
      if (kind === 'issuing' && options.orderId) {
        const existing = await salesOrderService.get(
          options.orderId,
          options.token
        );
        if (existing.data.invoiceIssuedAt) {
          options.onIssued();
          return;
        }
      }
      const id = await options.ensureSaved(true);
      if (!id)
        throw new Error(
          'Could not save invoice draft. Retry Save draft before continuing.'
        );
      if (kind !== 'issuing') await arApService.saveInvoiceDraft(options.token, id);
      if (kind === 'printing') await options.onPrint(id);
      if (kind === 'issuing') {
        await arApService.issueInvoice(
          options.token,
          id,
          options.dueDate || undefined
        );
        options.onIssued();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The invoice action could not finish. Try again.'
      );
    } finally {
      pending.current = false;
      setAction(null);
    }
  };
  return {
    action,
    error,
    save: () => run('saving'),
    print: () => run('printing'),
    issue: () => run('issuing'),
  };
}
