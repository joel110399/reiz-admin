import { Badge } from "@/components/ui/badge";
import { bookingStatusLabel, roleLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STATUS_CLASS: Record<string, string> = {
  pending:
    "border-transparent bg-amber-100 text-amber-900 dark:bg-amber-400/15 dark:text-amber-200",
  confirmed:
    "border-transparent bg-sky-100 text-sky-900 dark:bg-sky-400/15 dark:text-sky-200",
  completed:
    "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200",
  no_show:
    "border-transparent bg-zinc-200 text-zinc-800 dark:bg-zinc-400/15 dark:text-zinc-200",
  cancelled:
    "border-transparent bg-rose-100 text-rose-900 dark:bg-rose-400/15 dark:text-rose-200",
};

export function BookingStatusBadge({
  status,
  className,
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const key = status ?? "";
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        STATUS_CLASS[key] ?? "bg-muted text-muted-foreground",
        className
      )}
    >
      {bookingStatusLabel(status)}
    </Badge>
  );
}

export function ActiveBadge({
  active,
  trueLabel = "Activo",
  falseLabel = "Inactivo",
  className,
}: {
  active: boolean | null | undefined;
  trueLabel?: string;
  falseLabel?: string;
  className?: string;
}) {
  const on = !!active;
  return (
    <Badge
      variant="outline"
      className={cn(
        "font-medium",
        on
          ? "border-transparent bg-emerald-100 text-emerald-900 dark:bg-emerald-400/15 dark:text-emerald-200"
          : "border-transparent bg-muted text-muted-foreground",
        className
      )}
    >
      {on ? trueLabel : falseLabel}
    </Badge>
  );
}

export function RoleBadge({
  role,
  className,
}: {
  role: string | null | undefined;
  className?: string;
}) {
  return (
    <Badge variant="secondary" className={cn("font-medium", className)}>
      {roleLabel(role)}
    </Badge>
  );
}
