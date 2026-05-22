"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/contexts/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!user.is_staff) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  if (loading || !user || !user.is_staff) {
    return (
      <div className="flex min-h-[50vh] flex-col gap-4 p-8">
        <Skeleton className="h-10 w-full max-w-md" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return <>{children}</>;
}
