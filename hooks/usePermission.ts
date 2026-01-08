"use client";

import { useSession } from "next-auth/react";

export function usePermission() {
  const { data: session } = useSession();

  const can = (module: string, action: string) => {
    
    // Koristimo 'as any' da zaobiđemo TypeScript grešku
    const user = session?.user as any;

    // 1. SUPER_ADMIN uvijek može sve
    if (user?.role === "SUPER_ADMIN") return true;

    // 2. Ako nema sesije ili permisija, zabrani
    if (!user?.permissions) return false;

    // 3. Provjeri JSON iz baze
    // permissions format: { "evaluations": ["view", "create"] }
    const modulePermissions = user.permissions[module];
    
    if (!modulePermissions) return false;
    
    return modulePermissions.includes(action);
  };

  return { 
    can, 
    role: (session?.user as any)?.role,
    user: session?.user 
  };
}