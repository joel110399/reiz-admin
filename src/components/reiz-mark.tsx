import { cn } from "@/lib/utils";

export function ReizMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "bg-primary text-primary-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tracking-tight shadow-sm",
        className
      )}
      aria-hidden
    >
      R
    </span>
  );
}
