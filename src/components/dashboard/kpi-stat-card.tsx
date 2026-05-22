import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Trend = {
  value: number;
  label: string;
} | null;

type KpiStatCardProps = {
  title: string;
  subtitle?: string;
  value: ReactNode;
  icon: LucideIcon;
  trend?: Trend;
  className?: string;
};

export function KpiStatCard({
  title,
  subtitle,
  value,
  icon: Icon,
  trend,
  className,
}: KpiStatCardProps) {
  const up = trend && trend.value > 0;
  const down = trend && trend.value < 0;
  const flat = trend && trend.value === 0;

  return (
    <Card
      className={cn(
        "from-card to-muted/30 @container relative overflow-hidden bg-gradient-to-b shadow-none ring-1 ring-foreground/[0.06]",
        className
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <div className="space-y-1">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {title}
          </p>
          {subtitle ? (
            <p className="text-muted-foreground/80 text-[11px] leading-tight">
              {subtitle}
            </p>
          ) : null}
        </div>
        <div className="bg-primary/8 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
          <Icon className="size-4" strokeWidth={1.75} />
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="font-heading text-3xl leading-none font-semibold tracking-tight tabular-nums @[280px]:text-4xl">
          {value}
        </div>
        {trend ? (
          <p
            className={cn(
              "mt-2 flex items-center gap-1.5 text-xs font-medium",
              up && "text-emerald-600 dark:text-emerald-400",
              down && "text-rose-600 dark:text-rose-400",
              flat && "text-muted-foreground"
            )}
          >
            <span className="tabular-nums">
              {up ? "+" : ""}
              {trend.value.toFixed(1)}%
            </span>
            <span className="text-muted-foreground font-normal">
              {trend.label}
            </span>
          </p>
        ) : (
          <div className="mt-2 h-4" />
        )}
      </CardContent>
    </Card>
  );
}
