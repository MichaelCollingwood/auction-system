"use client";

import { SessionProvider } from "next-auth/react";
import { RealtimeProvider } from "@upstash/realtime/client";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <RealtimeProvider api={{ url: "/api/realtime", withCredentials: true }}>
        {children}
      </RealtimeProvider>
    </SessionProvider>
  );
}
