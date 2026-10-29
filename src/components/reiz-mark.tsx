import { cn } from "@/lib/utils";

/** Icono RZ de Reiz (el mismo de la app y del landing). */
export function ReizMark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/reiz-mark.png"
      alt=""
      aria-hidden
      className={cn("size-8 shrink-0 rounded-lg object-cover", className)}
    />
  );
}
