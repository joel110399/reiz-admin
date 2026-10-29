import * as React from "react";

import { cn } from "@/lib/utils";

type PageHeaderProps = {
  title: string;
  description?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  /** `2` cuando el encabezado va dentro de otra página (pestañas, etc.). */
  level?: 1 | 2;
  className?: string;
};

/** Encabezado de las páginas de listado: título, ayuda y acciones a la derecha. */
export function PageHeader({
  title,
  description,
  icon: Icon,
  actions,
  level = 1,
  className,
}: PageHeaderProps) {
  const Heading = level === 1 ? "h1" : "h2";
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-4 gap-y-3",
        className
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <span className="bg-accent text-accent-foreground hidden size-11 shrink-0 items-center justify-center rounded-xl sm:flex">
            <Icon className="size-5" />
          </span>
        ) : null}
        <div className="min-w-0">
          <Heading
            className={cn(
              "font-heading font-semibold tracking-[-0.03em] text-balance",
              level === 1 ? "text-[1.75rem] leading-tight" : "text-lg"
            )}
          >
            {title}
          </Heading>
          {description ? (
            <p className="text-muted-foreground mt-1 max-w-3xl text-[15px] leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </div>
  );
}
