import { io, type Socket } from 'socket.io-client';

/** Probe without credentials; serverless API instances never attach Socket.IO. */
export function openPOSRealtime(
  apiUrl: string,
  token: string,
  onSocket: (socket: Socket) => void
): () => void {
  const controller = new AbortController();
  let disposed = false;
  let socket: Socket | undefined;
  const timeout = setTimeout(() => controller.abort(), 5_000);

  void (async () => {
    try {
      const response = await fetch(`${apiUrl.replace(/\/$/, '')}/realtime-status`, {
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      if (!response.ok) return;
      const status: unknown = await response.json();
      if (disposed || controller.signal.aborted || !status || typeof status !== 'object'
        || !('available' in status) || status.available !== true) return;
      socket = io(apiUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnectionAttempts: 3,
        reconnectionDelay: 5_000,
        reconnectionDelayMax: 15_000,
        timeout: 5_000,
      });
      onSocket(socket);
    } catch {
      // REST polling remains authoritative when probing or connecting fails.
      socket?.disconnect();
    } finally {
      clearTimeout(timeout);
    }
  })();

  return () => {
    disposed = true;
    clearTimeout(timeout);
    controller.abort();
    socket?.disconnect();
  };
}
