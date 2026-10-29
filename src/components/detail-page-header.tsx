import Link from "next/link";
import * as React from "react";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

type DetailPageHeaderProps = {
  backHref: string;
  backLabel?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
};

export function DetailPageHeader({
  backHref,
  backLabel = "Volver",
  title,
  description,
  actions,
  className,
}: DetailPageHeaderProps) {
  return (
    <div className={cn("mb-6 space-y-1", className)}>
      <Link
        href={backHref}
        className="text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06] -ml-2.5 mb-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-heading text-[1.75rem] leading-tight font-semibold tracking-[-0.03em] text-balance md:text-[2rem]">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
