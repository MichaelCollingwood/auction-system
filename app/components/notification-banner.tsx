"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useRealtime } from "@/lib/realtime-client";
import {
  requestNotificationPermission,
  subscribeToWebPush,
  showBrowserNotification,
} from "@/lib/browser-notification";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBanner() {
  const { data: session, status } = useSession();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [expanded, setExpanded] = useState(false);

  const fetchNotifications = useCallback(async () => {
    const res = await fetch("/api/notifications");
    if (res.ok) {
      const data = await res.json();
      setNotifications(data);
    }
  }, []);

  useEffect(() => {
    if (status === "authenticated" && session?.user?.id) {
      fetchNotifications();
    }
  }, [status, session?.user?.id, fetchNotifications]);

  useRealtime({
    channels: session?.user?.id ? [`users:${session.user.id}`] : [],
    events: ["notification.alert"],
    onData: useCallback(
      ({ data: payload }: { event: string; data: unknown }) => {
        const p = payload as { id: string; type: string; title: string; message: string; link?: string };
        setNotifications((prev) => [
          {
            id: p.id,
            type: p.type,
            title: p.title,
            message: p.message,
            link: p.link ?? null,
            read: false,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ].slice(0, 20));
        const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
        showBrowserNotification(p.title, p.message, p.link ? `${baseUrl}${p.link}` : undefined);
      },
      [session?.user?.id]
    ),
    enabled: !!session?.user?.id,
  });

  const unreadNotifications = notifications.filter((n) => !n.read);

  const markRead = async (id: string) => {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  const markAllRead = async () => {
    const res = await fetch("/api/notifications", { method: "PATCH" });
    if (res.ok) {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    }
  };

  const unreadCount = unreadNotifications.length;
  const [browserEnabled, setBrowserEnabled] = useState(false);

  useEffect(() => {
    setBrowserEnabled(
      typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
    );
  }, []);

  const enableBrowserNotifications = async () => {
    const ok = await subscribeToWebPush();
    if (!ok) {
      const fallback = await requestNotificationPermission();
      setBrowserEnabled(fallback);
    } else {
      setBrowserEnabled(true);
    }
  };

  if (status !== "authenticated" || !session?.user?.id) return null;

  return (
    <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto max-w-4xl px-4 py-2">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="flex flex-1 items-center justify-between rounded-lg px-3 py-2 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <span className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-50">
              Notifications
              {unreadCount > 0 && (
                <span className="animate-pulse rounded-full bg-amber-500 px-2 py-0.5 text-xs font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {expanded ? "▼" : "▶"}
            </span>
          </button>
          {!browserEnabled && (
            <button
              type="button"
              onClick={enableBrowserNotifications}
              className="shrink-0 rounded-md border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600"
            >
              Enable browser alerts
            </button>
          )}
        </div>

        {expanded && (
          <div className="max-h-64 space-y-1 overflow-y-auto py-2">
            {unreadCount > 0 && (
              <div className="mb-2 flex justify-end px-3">
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                >
                  Mark all as read
                </button>
              </div>
            )}
            {unreadNotifications.length === 0 ? (
              <p className="px-3 py-4 text-sm text-zinc-500 dark:text-zinc-400">
                No unread notifications
              </p>
            ) : (
              unreadNotifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between gap-2 rounded-lg bg-amber-50 px-3 py-2 dark:bg-amber-900/20"
                >
                  <div className="min-w-0 flex-1">
                    {n.link ? (
                      <Link
                        href={n.link}
                        onClick={() => markRead(n.id)}
                        className="block hover:underline"
                      >
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {n.title}
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {n.message}
                        </p>
                      </Link>
                    ) : (
                      <>
                        <p className="font-medium text-zinc-900 dark:text-zinc-50">
                          {n.title}
                        </p>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {n.message}
                        </p>
                      </>
                    )}
                  </div>
                  {!n.read && (
                    <button
                      type="button"
                      onClick={() => markRead(n.id)}
                      className="shrink-0 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                    >
                      Mark read
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
