"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export function ThemedToaster() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const theme =
    mounted && resolvedTheme === "dark" ? "dark" : "light";

  return (
    <Toaster richColors position="top-center" theme={theme} />
  );
}
