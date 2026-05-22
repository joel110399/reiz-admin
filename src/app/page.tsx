"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { hasStoredToken } from "@/lib/auth-storage";

export default function Home() {
  const router = useRouter();

  React.useEffect(() => {
    router.replace(hasStoredToken() ? "/dashboard" : "/login");
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground text-sm">Cargando…</p>
    </div>
  );
}
