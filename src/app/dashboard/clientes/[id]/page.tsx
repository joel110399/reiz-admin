"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { ClientMergeButton } from "@/components/client-merge-dialog";
import { DetailPageHeader } from "@/components/detail-page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiJson } from "@/lib/api-client";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ClientDetail = {
  id: number;
  business: number;
  business_name?: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
};

type BookingHistory = {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  business: number | { id: number; name?: string };
  service_detail?: { name?: string } | null;
  notes?: string | null;
};

function timeShort(t: string | undefined) {
  if (!t) return "—";
  return t.length >= 8 ? t.slice(0, 5) : t;
}

function businessName(
  b: number | { id: number; name?: string } | undefined
): string {
  if (b == null) return "—";
  return typeof b === "object" && "name" in b && b.name
    ? String(b.name)
    : `#${typeof b === "object" ? b.id : b}`;
}

export default function ClienteDetailPage() {
  const params = useParams();
  const qc = useQueryClient();
  const id = String(params.id ?? "");

  const { data: client, isLoading, error } = useQuery({
    queryKey: ["client-detail", id],
    queryFn: () => apiJson<ClientDetail>(`/api/bookings/clients/${id}/`),
    enabled: !!id,
  });

  const { data: bookings = [], isLoading: loadingBookings } = useQuery({
    queryKey: ["client-bookings", id],
    queryFn: () =>
      apiJson<BookingHistory[]>(`/api/bookings/clients/${id}/bookings/`),
    enabled: !!id && !!client,
  });

  const sortedBookings = React.useMemo(() => {
    return [...bookings].sort((a, b) => {
      const da = String(a.date ?? "");
      const db = String(b.date ?? "");
      if (da !== db) return db.localeCompare(da);
      return String(b.start_time ?? "").localeCompare(String(a.start_time ?? ""));
    });
  }, [bookings]);

  if (!id) {
    return (
      <p className="text-muted-foreground text-sm">ID de cliente no válido.</p>
    );
  }

  if (isLoading) {
    return (
      <p className="text-muted-foreground text-sm">Cargando cliente…</p>
    );
  }

  if (error || !client) {
    return (
      <>
        <DetailPageHeader
          backHref="/dashboard/clientes"
          title="Cliente"
          description="No se pudo cargar el registro."
        />
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : "Error desconocido"}
        </p>
      </>
    );
  }

  const bid = client.business;

  return (
    <>
      <DetailPageHeader
        backHref="/dashboard/clientes"
        title={client.name}
        description={`Cliente #${client.id} · ${client.business_name ?? `Negocio #${bid}`}`}
        actions={
          <ClientMergeButton
            client={client}
            onMerged={() => {
              qc.invalidateQueries({ queryKey: ["client-detail", id] });
              qc.invalidateQueries({ queryKey: ["client-bookings", id] });
              qc.invalidateQueries({ queryKey: ["clients"] });
            }}
          />
        }
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Datos</CardTitle>
            <CardDescription>Contacto y notas internas</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Email</span>
              <span className="text-right">{client.email ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Teléfono</span>
              <span className="text-right">{client.phone ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Negocio</span>
              <span className="text-right">
                <Link
                  href={`/dashboard/negocios/${bid}`}
                  className="text-primary hover:underline"
                >
                  {client.business_name ?? `#${bid}`}
                </Link>
              </span>
            </div>
            {client.notes ? (
              <div className="border-border mt-2 border-t pt-2">
                <span className="text-muted-foreground block text-xs">
                  Notas
                </span>
                <p className="mt-1 whitespace-pre-wrap">{client.notes}</p>
              </div>
            ) : null}
            <div className="text-muted-foreground mt-2 text-xs">
              Creado: {client.created_at?.slice(0, 19) ?? "—"} · Actualizado:{" "}
              {client.updated_at?.slice(0, 19) ?? "—"}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Resumen citas</CardTitle>
            <CardDescription>
              {sortedBookings.length} registro
              {sortedBookings.length === 1 ? "" : "s"} en historial
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm">
            {loadingBookings ? (
              <p className="text-muted-foreground">Cargando historial…</p>
            ) : sortedBookings.length === 0 ? (
              <p className="text-muted-foreground">
                Sin citas asociadas a este cliente.
              </p>
            ) : (
              <ul className="space-y-1">
                {["pending", "confirmed", "completed", "cancelled"].map(
                  (st) => {
                    const n = sortedBookings.filter((b) => b.status === st)
                      .length;
                    if (!n) return null;
                    return (
                      <li key={st} className="flex justify-between">
                        <span>{st}</span>
                        <span className="text-muted-foreground">{n}</span>
                      </li>
                    );
                  }
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Historial de citas</CardTitle>
          <CardDescription>
            Todas las reservas vinculadas a este cliente
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {loadingBookings ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Cargando…
            </p>
          ) : sortedBookings.length === 0 ? (
            <p className="text-muted-foreground px-4 py-6 text-sm">
              Sin citas.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[72px]">ID</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Horario</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Servicio</TableHead>
                  <TableHead>Negocio</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedBookings.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-mono text-xs">{b.id}</TableCell>
                    <TableCell>{b.date}</TableCell>
                    <TableCell>
                      {timeShort(b.start_time)}–{timeShort(b.end_time)}
                    </TableCell>
                    <TableCell>{b.status}</TableCell>
                    <TableCell>
                      {b.service_detail?.name ?? "—"}
                    </TableCell>
                    <TableCell>{businessName(b.business)}</TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/dashboard/reservas/${b.id}`}
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" })
                        )}
                      >
                        Ver reserva
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
