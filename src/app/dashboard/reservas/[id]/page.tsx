"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { BookingEditForm } from "@/components/booking-edit-form";
import { DetailPageHeader } from "@/components/detail-page-header";
import { BookingStatusBadge } from "@/components/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { apiJson } from "@/lib/api-client";
import { timeShort } from "@/lib/labels";
import { pushRecentCase } from "@/lib/recent-cases";
import * as React from "react";
import { formatDateTime } from "@/lib/format";

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

export default function ReservaDetailPage() {
  const params = useParams();
  const id = String(params.id ?? "");

  const { data: b, isLoading, error } = useQuery({
    queryKey: ["booking-detail", id],
    queryFn: () => apiJson<BookingDetail>(`/api/bookings/${id}/`),
    enabled: !!id,
  });

  React.useEffect(() => {
    if (!b) return;
    pushRecentCase({
      kind: "booking",
      id: b.id,
      label: `Reserva #${b.id}`,
      href: `/dashboard/reservas/${b.id}`,
    });
  }, [b]);

  if (!id) {
    return (
      <p className="text-muted-foreground text-sm">ID de reserva no válido.</p>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
        </div>
      </div>
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
  const clientId =
    b.client_detail?.id ?? (typeof b.client === "number" ? b.client : null);

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
        description={`${b.date} · ${timeShort(b.start_time)}–${timeShort(b.end_time)}`}
        actions={<BookingStatusBadge status={b.status} className="h-6 px-2.5" />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Resolver caso</CardTitle>
            <CardDescription>
              Confirma, reprograma o cancela sin volver al listado
            </CardDescription>
          </CardHeader>
          <CardContent>
            <BookingEditForm booking={b} />
          </CardContent>
        </Card>

        <Card className="shadow-none">
          <CardHeader>
            <CardTitle>Contexto</CardTitle>
            <CardDescription>Personas y servicio de esta cita</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
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
                <span className="text-muted-foreground text-xs">
                  Profesional
                </span>
                <p className="mt-0.5">
                  {b.team_member_detail?.name ?? `#${b.team_member}`}
                </p>
              </div>
            ) : null}
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Sin cita previa</span>
              <span>{b.is_walk_in ? "Sí" : "No"}</span>
            </div>
            <p className="text-muted-foreground text-xs">
              Creado: {formatDateTime(b.created_at)} · Actualizado:{" "}
              {formatDateTime(b.updated_at)}
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
