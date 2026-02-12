"use client";

import { SessionProvider } from "next-auth/react";
import AutoLogout from "./AutoLogout";

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
      {hasSession && <AutoLogout />}
      {children}
    </SessionProvider>
  );
}