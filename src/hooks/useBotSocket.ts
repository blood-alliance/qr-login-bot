import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

export type BotStatus = "starting" | "qr" | "authenticated" | "ready" | "disconnected" | "unknown";

export function useBotSocket(serverUrl: string | null, apiToken: string | null) {
  const [status, setStatus] = useState<BotStatus>("unknown");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [info, setInfo] = useState<{ pushname?: string; wid?: string } | null>(null);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!serverUrl || !apiToken) return;
    let cancelled = false;
    const s = io(serverUrl, {
      auth: { token: apiToken },
      transports: ["websocket", "polling"],
      reconnection: true,
    });
    socketRef.current = s;

    s.on("connect", () => !cancelled && setConnected(true));
    s.on("disconnect", () => !cancelled && setConnected(false));
    s.on("connect_error", () => !cancelled && setConnected(false));
    s.on("status", (p: { status: BotStatus; info?: any }) => {
      if (cancelled) return;
      setStatus(p.status || "unknown");
      if (p.info) setInfo(p.info);
      if (p.status === "ready" || p.status === "authenticated") setQrDataUrl(null);
    });
    s.on("qr", (p: { dataUrl: string }) => !cancelled && setQrDataUrl(p.dataUrl));

    return () => {
      cancelled = true;
      s.disconnect();
      socketRef.current = null;
    };
  }, [serverUrl, apiToken]);

  return { status, qrDataUrl, info, connected, socket: socketRef.current };
}
