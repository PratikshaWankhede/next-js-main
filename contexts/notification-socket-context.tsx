"use client";

import { useAuth } from "@/contexts/auth-context";
import { useCurrentLeadId } from "@/contexts/current-lead-id-context";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type NotificationSocketContextValue = {
  unreadCount: number;
  setUnreadCount: React.Dispatch<React.SetStateAction<number>>;
};

const NotificationSocketContext =
  createContext<NotificationSocketContextValue | null>(null);

function resolveWsUrl(): string | null {
  // Prefer explicit public URL when configured at build time.
  const envUrl = process.env.NEXT_PUBLIC_WS_URL;
  if (envUrl && typeof envUrl === "string" && envUrl.trim().length > 0) {
    return envUrl;
  }

  if (typeof window === "undefined") return null;
  const isHttps = window.location.protocol === "https:";
  const proto = isHttps ? "wss" : "ws";
  const host = window.location.hostname;
  const port =
    window.location.port && window.location.port !== "3000"
      ? window.location.port
      : "3001";
  return `${proto}://${host}:${port}/ws`;
}

function playNotificationSound() {
  if (typeof window === "undefined") return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.start(now);
    osc.stop(now + 0.15);
    // Second beep for "new message" feel
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.value = 1100;
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    const t2 = now + 0.2;
    gain2.gain.setValueAtTime(0.001, t2);
    gain2.gain.exponentialRampToValueAtTime(0.1, t2 + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.12);
    osc2.start(t2);
    osc2.stop(t2 + 0.12);
  } catch {
    // ignore audio errors
  }
}

export function NotificationSocketProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  const currentLeadId = useCurrentLeadId();
  const [unreadCount, setUnreadCount] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const joinedLeadIdRef = useRef<string | null>(null);

  // Initial unread count sync
  useEffect(() => {
    if (!user?.id) {
      return;
    }

    let cancelled = false;

    const fetchUnread = async () => {
      try {
        const res = await fetch(
          "/api/notifications?unread=true&limit=99",
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data = (await res.json()) as { notifications?: unknown[] };
        if (!cancelled) {
          setUnreadCount(data.notifications?.length ?? 0);
        }
      } catch {
        // ignore fetch errors; websocket updates will still work
      }
    };

    void fetchUnread();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Join/leave lead room when viewing a lead
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    if (joinedLeadIdRef.current && joinedLeadIdRef.current !== currentLeadId) {
      ws.send(JSON.stringify({ type: "leave", leadId: joinedLeadIdRef.current }));
      joinedLeadIdRef.current = null;
    }

    if (currentLeadId) {
      ws.send(JSON.stringify({ type: "join", leadId: currentLeadId }));
      joinedLeadIdRef.current = currentLeadId;
    }
  }, [currentLeadId]);

  // WebSocket subscription for per-user and per-lead notifications
  useEffect(() => {
    if (!user?.id) return;

    let closedByEffect = false;

    const connect = () => {
      const url = resolveWsUrl();
      if (!url) return;

      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "join-user", userId: user.id }));
        // Join lead room if we're viewing a lead (handles connect-after-navigate case)
        if (currentLeadId) {
          ws.send(JSON.stringify({ type: "join", leadId: currentLeadId }));
          joinedLeadIdRef.current = currentLeadId;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data as string) as {
            type?: string;
            userId?: string;
            notification?: { title?: string; body?: string; leadId?: string };
          };
          if (data.type !== "notification:new") return;
          // User room: only for this user. Lead room: no userId (broadcast to viewers).
          if (data.userId != null && data.userId !== user.id) return;

          const notif = data.notification;
          const isTabVisible =
            typeof document !== "undefined" &&
            document.visibilityState === "visible";

          if (isTabVisible) {
            playNotificationSound();
          }

          if (
            !isTabVisible &&
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted" &&
            notif?.title
          ) {
            try {
              const n = new Notification(notif.title, {
                body: notif.body ?? "",
                tag: notif.leadId ?? `notif-${Date.now()}`,
                requireInteraction: false,
              });
              n.onclick = () => {
                window.focus();
                if (notif.leadId) {
                  window.location.href = `/leads/${notif.leadId}`;
                }
                n.close();
              };
            } catch {
              // ignore notification errors
            }
          }

          setUnreadCount((prev) => prev + 1);
        } catch {
          // ignore malformed payloads
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        if (!closedByEffect) {
          setTimeout(connect, 2000);
        }
      };
    };

    connect();

    return () => {
      closedByEffect = true;
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
      joinedLeadIdRef.current = null;
    };
  }, [user?.id, currentLeadId]);

  const value = useMemo(
    () => ({
      unreadCount,
      setUnreadCount,
    }),
    [unreadCount],
  );

  return (
    <NotificationSocketContext.Provider value={value}>
      {children}
    </NotificationSocketContext.Provider>
  );
}

export function useNotificationSocket() {
  const ctx = useContext(NotificationSocketContext);
  if (!ctx) {
    throw new Error(
      "useNotificationSocket must be used within a NotificationSocketProvider",
    );
  }
  return ctx;
}

