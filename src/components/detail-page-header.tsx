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
        className="text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5 text-sm transition-colors"
      >
        <ArrowLeft className="size-4" />
        {backLabel}
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight md:text-2xl">
            {title}
          </h1>
          {description ? (
            <p className="text-muted-foreground max-w-3xl text-sm">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}
