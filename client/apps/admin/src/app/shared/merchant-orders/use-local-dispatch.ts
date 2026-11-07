'use client';
import { useRef, useState } from 'react';
import {
  dispatchRequest,
  type DispatchOptions,
  type DispatchQuote,
} from '@/services/local-dispatch.service';
type View = {
  context: string;
  epoch: number;
  options?: DispatchOptions;
  quote?: DispatchQuote;
  busy: boolean;
  error: string;
};
export function useLocalDispatch(
  token: string,
  child: string,
  onChange?: () => void | Promise<void>
) {
  const context = JSON.stringify([token, child]);
  const current = useRef({ context, epoch: 0, request: 0 });
  if (current.current.context !== context)
    current.current = { context, epoch: current.current.epoch + 1, request: 0 };
  const epoch = current.current.epoch;
  const [saved, setSaved] = useState<View>({
    context,
    epoch,
    busy: false,
    error: '',
  });
  const view =
    saved.context === context && saved.epoch === epoch
      ? saved
      : { context, epoch, busy: false, error: '' };
  const keys = useRef(new Map<string, string>());
  const valid = (request: number) =>
    current.current.context === context &&
    current.current.epoch === epoch &&
    current.current.request === request;
  function update(request: number, values: Partial<View>) {
    if (valid(request))
      setSaved((old) => ({
        ...(old.context === context && old.epoch === epoch
          ? old
          : { context, epoch, busy: false, error: '' }),
        ...values,
      }));
  }
  async function load(request: number) {
    const data = await dispatchRequest<DispatchOptions>(
      token,
      `/orders/${child}/options`
    );
    update(request, { options: data });
  }
  async function execute(work: (request: number) => Promise<void>) {
    if (current.current.context !== context || current.current.epoch !== epoch)
      return;
    const request = ++current.current.request;
    update(request, { busy: true, error: '' });
    try {
      await work(request);
    } catch (e) {
      update(request, {
        error:
          e instanceof Error
            ? e.message
            : 'Delivery outcome is uncertain. Retry the same action.',
      });
    } finally {
      update(request, { busy: false });
    }
  }
  async function open() {
    await execute(load);
  }
  async function getQuote(lines: { line: string; quantity: number }[]) {
    await execute(async (request) => {
      update(request, { quote: undefined });
      if (!lines.length) throw new Error('Choose at least one item quantity.');
      const data = await dispatchRequest<{ quote: DispatchQuote }>(
        token,
        `/orders/${child}/quotes`,
        'POST',
        { lines }
      );
      update(request, { quote: data.quote });
    });
  }
  async function perform(path: string, payload: Record<string, unknown>) {
    const identity = JSON.stringify([context, path, payload]);
    let key = keys.current.get(identity);
    if (!key) {
      key = crypto.randomUUID();
      keys.current.set(identity, key);
    }
    await execute(async (request) => {
      await dispatchRequest(token, path, 'POST', {
        ...payload,
        idempotencyKey: key,
      });
      if (!valid(request)) return;
      update(request, { quote: undefined });
      await load(request);
      if (valid(request)) await onChange?.();
    });
  }
  function setQuote(quote: DispatchQuote | undefined) {
    update(current.current.request, { quote });
  }
  return {
    options: view.options,
    quote: view.quote,
    busy: view.busy,
    error: view.error,
    open,
    getQuote,
    perform,
    setQuote,
  };
}
