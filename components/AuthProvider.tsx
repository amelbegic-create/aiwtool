"use client";

import { SessionProvider } from "next-auth/react";
import AutoLogoutProvider from "./auth/AutoLogoutProvider";

type Props = {
  children: React.ReactNode;
};

export default function AuthProvider({ children }: Props) {
  return (
    <SessionProvider
      refetchInterval={5 * 60}
      refetchOnWindowFocus={false}
    >
      <AutoLogoutProvider>
        {children}
      </AutoLogoutProvider>
    </SessionProvider>
  );
}