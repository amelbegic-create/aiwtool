"use client";

import { SessionProvider } from "next-auth/react";
import AutoLogout from "./AutoLogout";

type Props = {
  children: React.ReactNode;
  hasSession?: boolean;
};

export default function AuthProvider({ children }: Props) {
  return (
    <SessionProvider
      refetchInterval={5 * 60}
      refetchOnWindowFocus={false}
    >
      <AutoLogout />
      {children}
    </SessionProvider>
  );
}