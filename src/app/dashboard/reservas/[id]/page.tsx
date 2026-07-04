"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { DetailPageHeader } from "@/components/detail-page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiJson } from "@/lib/api-client";

type BookingDetail = {
  id: number;
  client: number | null;
  client_detail?: {
    id: number;
    name?: string;
    email?: string | null;
    phone?: string | null;
    business?: number;
    business_name?: string;
  } | null;
  business: number | { id: number; name?: string };
  business_detail?: { id: number; name?: string; slug?: string | null } | null;
  service: number | null;
  service_detail?: {
    id: number;
    name?: string;
    price?: string;
    duration_minutes?: number;
  } | null;
  team_member: number | null;
  team_member_detail?: { id: number; name?: string } | null;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  notes?: string | null;
  is_walk_in?: boolean;
  created_at?: string;
  updated_at?: string;
};

function timeShort(t: string | undefined) {
  if (!t) return "—";
  return t.length >= 8 ? t.slice(0, 5) : t;
}

export default function ReservaDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const { data: b, isLoading, error } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => apiJson<BookingDetail>(`/api/bookings/${id}/`),
    enabled: !!id,
  });

  if (!id) {
    return (
      <p className="text-muted-foreground text-sm">ID de reserva no válido.</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Cargando reserva…</p>
    );
  }

  if (error || !b) {
    return (
      <>
        <DetailPageHeader
          backHref="/dashboard/reservas"
          title="Reserva"
          description="No se pudo cargar el registro."
        />
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </>
    );
  }

  const bizId =
    typeof b.business === "object" && b.business
      ? b.business.id
      : Number(b.business);
  const clientId = b.client_detail?.id ?? (typeof b.client === "number" ? b.client : null);

  const bizName =
    b.business_detail?.name ??
    (typeof b.business === "object" && b.business && "name" in b.business
      ? (b.business as { name?: string }).name
      : null);

  return (
    <>
      <DetailPageHeader
        backHref="/dashboard/reservas"
        title={`Reserva #${b.id}`}
        description={`${b.date} · ${timeShort(b.start_time)}–${timeShort(b.end_time)} · ${b.status}`}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Estado y horario</CardTitle>
            <CardDescription>Campos editables desde el listado</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Estado</span>
              <span>{b.status}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Fecha</span>
              <span>{b.date}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Inicio / fin</span>
              <span className="font-mono">
                {timeShort(b.start_time)} – {timeShort(b.end_time)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sin cita</span>
              <span>{b.is_walk_in ? "Sí" : "No"}</span>
            </div>
            {b.notes ? (
              <div className="border-border mt-2 border-t pt-2">
                <span className="text-muted-foreground text-xs">Notas</span>
                <p className="mt-1 whitespace-pre-wrap">{b.notes}</p>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Relaciones</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <div>
              <span className="text-muted-foreground text-xs">Negocio</span>
              <p className="mt-0.5">
                <Link
                  href={`/dashboard/negocios/${bizId}`}
                  className="text-primary hover:underline"
                >
                  {bizName ?? `#${bizId}`}
                </Link>
              </p>
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Cliente</span>
              <p className="mt-0.5">
                {clientId ? (
                  <Link
                    href={`/dashboard/clientes/${clientId}`}
                    className="text-primary hover:underline"
                  >
                    {b.client_detail?.name ?? `#${clientId}`}
                  </Link>
                ) : (
                  "—"
                )}
              </p>
              {b.client_detail?.email || b.client_detail?.phone ? (
                <p className="text-muted-foreground mt-1 text-xs">
                  {[b.client_detail?.email, b.client_detail?.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </div>
            <div>
              <span className="text-muted-foreground text-xs">Servicio</span>
              <p className="mt-0.5">
                {b.service_detail
                  ? `${b.service_detail.name}${b.service_detail.price ? ` (${b.service_detail.price})` : ""}${b.service_detail.duration_minutes != null ? ` · ${b.service_detail.duration_minutes} min` : ""}`
                  : b.service != null
                    ? `#${b.service}`
                    : "—"}
              </p>
            </div>
            {b.team_member_detail || b.team_member ? (
              <div>
                <span className="text-muted-foreground text-xs">Profesional</span>
                <p className="mt-0.5">
                  {b.team_member_detail?.name ?? `#${b.team_member}`}
                </p>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground mt-6 text-xs">
        Creado: {b.created_at?.slice(0, 19) ?? "—"} · Actualizado:{" "}
        {b.updated_at?.slice(0, 19) ?? "—"}
      </p>
    </>
  );
}
