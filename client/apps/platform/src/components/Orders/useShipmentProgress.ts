"use client";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";
import { fetchWithAuth } from "@/lib/fetchWithAuth";
import type { ShipmentProgressData } from "./types";
interface State {
  key: string;
  data?: ShipmentProgressData;
  error?: string;
  denied?: boolean;
}
export function useShipmentProgress(
  orderId: string,
  sessionKey: string | null,
) {
  const key = JSON.stringify([orderId, sessionKey]);
  const [state, setState] = useState<State | null>(null),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!sessionKey || !orderId) return;
    const controller = new AbortController();
    let active = true;
    setState({ key });
    void (async () => {
      try {
        const response = await fetchWithAuth(
          `${API_URL}/api/customer-shipments/${encodeURIComponent(orderId)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) {
          if (active)
            setState({
              key,
              error: [401, 403, 404].includes(response.status)
                ? "Shipment progress is unavailable for this account."
                : "Could not load shipment progress. Please retry.",
              denied: [401, 403, 404].includes(response.status),
            });
          return;
        }
        const payload = await response.json();
        if (
          payload.data?.orderId !== orderId ||
          !Array.isArray(payload.data?.groups)
        )
          throw new Error("Invalid shipment response");
        if (active) setState({ key, data: payload.data });
      } catch {
        if (active)
          setState({
            key,
            error: "Could not load shipment progress. Please retry.",
          });
      }
    })();
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, orderId, sessionKey, revision]);
  const current = state?.key === key ? state : null;
  return {
    data: sessionKey ? current?.data : undefined,
    error: sessionKey ? current?.error : undefined,
    denied: current?.denied,
    loading: !!sessionKey && !current?.data && !current?.error,
    refresh: () => setRevision((value) => value + 1),
  };
}
