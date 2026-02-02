"use client";

import { SessionProvider } from "next-auth/react";
import IdleLogout from "./IdleLogout";

type Props = {
  children: React.ReactNode;
  hasSession?: boolean;
};

export default function AuthProvider({ children, hasSession }: Props) {
  return (
    <SessionProvider
      refetchInterval={5 * 60}
      refetchOnWindowFocus={false}
    >
      {hasSession && <IdleLogout timeoutMs={10 * 60 * 1000} />}
      {children}
    </SessionProvider>
  );
}