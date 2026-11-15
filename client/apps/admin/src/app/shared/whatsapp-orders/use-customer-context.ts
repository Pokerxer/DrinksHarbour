'use client';

import { useEffect, useState } from 'react';
import {
  whatsappOrderService,
  type WhatsAppCustomerContext,
} from '@/services/whatsapp-order.service';

export default function useCustomerContext(token: string, customerId?: string) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    token: string;
    customerId: string;
    attempt: number;
    context: WhatsAppCustomerContext | null;
  } | null>(null);
  useEffect(() => {
    if (!token || !customerId) return;
    const controller = new AbortController();
    function complete(context: WhatsAppCustomerContext | null) {
      if (!controller.signal.aborted && customerId) {
        setResult({ token, customerId, attempt, context });
      }
    }
    whatsappOrderService
      .getCustomerContext(token, customerId, controller.signal)
      .then(complete)
      .catch(() => complete(null));
    return () => controller.abort();
  }, [token, customerId, attempt]);

  const current =
    result?.customerId === customerId &&
    result?.token === token &&
    result?.attempt === attempt
      ? result
      : null;
  return {
    context: current?.context ?? null,
    loading: Boolean(token && customerId && !current),
    failed: current?.context === null,
    retry: () => setAttempt((value) => value + 1),
  };
}
