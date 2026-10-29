import { Skeleton } from "@/components/ui/skeleton";

/** Lo que se ve mientras carga una ficha de detalle. */
export function DetailPageSkeleton({ cards = 2 }: { cards?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Cargando">
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from({ length: cards }, (_, i) => (
          <Skeleton key={i} className="h-56 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
